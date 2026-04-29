import {
  RekognitionClient,
  CreateCollectionCommand,
  IndexFacesCommand,
  SearchFacesByImageCommand,
  DeleteFacesCommand,
  DeleteCollectionCommand,
  ListCollectionsCommand,
  ResourceAlreadyExistsException,
  type RekognitionClientConfig,
} from "@aws-sdk/client-rekognition";
import type { BiometricProvider } from "@/lib/biometric/types";
import { BiometricProviderError } from "@/lib/biometric/errors";

const REGION = process.env.AWS_REGION ?? "eu-west-2";

function collectionIdForEvent(eventId: string): string {
  return `facegate-${eventId}`;
}

function wrapAws(provider: string, err: unknown): never {
  const message = err instanceof Error ? err.message : String(err);
  throw new BiometricProviderError(`AWS Rekognition: ${message}`, provider, {
    cause: err,
  });
}

export class AWSProvider implements BiometricProvider {
  private readonly client: RekognitionClient;

  constructor(config?: RekognitionClientConfig) {
    this.client = new RekognitionClient({
      region: REGION,
      ...config,
    });
  }

  async enroll(options: {
    eventId: string;
    guestId: string;
    imageBase64: string;
  }): Promise<{ ref: string; provider: string }> {
    const collectionId = collectionIdForEvent(options.eventId);
    const bytes = Buffer.from(options.imageBase64, "base64");

    try {
      try {
        await this.client.send(
          new CreateCollectionCommand({ CollectionId: collectionId })
        );
      } catch (e) {
        if (!(e instanceof ResourceAlreadyExistsException)) {
          wrapAws("aws-rekognition", e);
        }
      }

      const out = await this.client.send(
        new IndexFacesCommand({
          CollectionId: collectionId,
          Image: { Bytes: bytes },
          ExternalImageId: options.guestId,
          MaxFaces: 1,
          QualityFilter: "AUTO",
        })
      );

      const faceId = out.FaceRecords?.[0]?.Face?.FaceId;
      if (!faceId) {
        throw new BiometricProviderError(
          "No face indexed — ensure a clear frontal face is visible",
          "aws-rekognition"
        );
      }

      return { ref: faceId, provider: "aws-rekognition" };
    } catch (e) {
      if (e instanceof BiometricProviderError) throw e;
      wrapAws("aws-rekognition", e);
    }
  }

  async match(options: {
    eventId: string;
    imageBase64: string;
    enrolledRefs: string[];
  }): Promise<{
    matched: boolean;
    matchedRef?: string;
    confidence?: number;
  }> {
    void options.enrolledRefs;
    const collectionId = collectionIdForEvent(options.eventId);
    const bytes = Buffer.from(options.imageBase64, "base64");

    try {
      const out = await this.client.send(
        new SearchFacesByImageCommand({
          CollectionId: collectionId,
          Image: { Bytes: bytes },
          FaceMatchThreshold: 90,
          MaxFaces: 5,
        })
      );

      const top = out.FaceMatches?.[0];
      if (!top?.Face?.FaceId) {
        return { matched: false };
      }

      return {
        matched: true,
        matchedRef: top.Face.FaceId,
        confidence: top.Similarity,
      };
    } catch (e) {
      wrapAws("aws-rekognition", e);
    }
  }

  async deleteRefs(options: {
    eventId: string;
    refs: string[];
  }): Promise<{ deleted: string[]; failed: string[] }> {
    const collectionId = collectionIdForEvent(options.eventId);
    const deleted: string[] = [];
    const failed: string[] = [];

    try {
      const out = await this.client.send(
        new DeleteFacesCommand({
          CollectionId: collectionId,
          FaceIds: options.refs,
        })
      );
      for (const id of out.DeletedFaces ?? []) {
        deleted.push(id);
      }
      for (const row of out.UnsuccessfulFaceDeletions ?? []) {
        if (row.FaceId) failed.push(row.FaceId);
      }
      return { deleted, failed };
    } catch (e) {
      wrapAws("aws-rekognition", e);
    }
  }

  async deleteCollection(eventId: string): Promise<{ success: boolean }> {
    const collectionId = collectionIdForEvent(eventId);
    try {
      await this.client.send(new DeleteCollectionCommand({ CollectionId: collectionId }));
      return { success: true };
    } catch (e) {
      wrapAws("aws-rekognition", e);
    }
  }

  async status(): Promise<{ ready: boolean; provider: string }> {
    try {
      await this.client.send(new ListCollectionsCommand({ MaxResults: 1 }));
      return { ready: true, provider: "aws-rekognition" };
    } catch (e) {
      wrapAws("aws-rekognition", e);
    }
  }
}
