"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StaffRole } from "@prisma/client";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.nativeEnum(StaffRole),
});

export default function NewStaffPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<StaffRole>(StaffRole.STAFF);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    const parsed = schema.safeParse({ name, email, password, role });
    if (!parsed.success) {
      const f = parsed.error.flatten().fieldErrors;
      setErrors({
        name: f.name?.[0] ?? "",
        email: f.email?.[0] ?? "",
        password: f.password?.[0] ?? "",
        role: f.role?.[0] ?? "",
      });
      return;
    }
    setLoading(true);
    const res = await fetch("/api/admin/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...parsed.data,
        email: parsed.data.email.toLowerCase().trim(),
      }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok || json.error) {
      setErrors({ form: json.error ?? "Could not create user" });
      return;
    }
    router.push("/people");
    router.refresh();
  }

  return (
    <Card className="mx-auto max-w-lg border-fg-line bg-fg-surface">
      <CardHeader>
        <CardTitle className="text-fg-ink">Create staff user</CardTitle>
        <CardDescription className="text-fg-mist">
          Credentials are hashed with bcrypt before storage.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          {errors.form ? <p className="text-sm text-fg-danger-text">{errors.form}</p> : null}
          <div className="space-y-2">
            <Label htmlFor="sname">Name</Label>
            <Input
              id="sname"
              value={name}
              onChange={(ev) => setName(ev.target.value)}
              className="border-fg-line bg-fg-elevated"
            />
            {errors.name ? <p className="text-sm text-fg-danger-text">{errors.name}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="semail">Email</Label>
            <Input
              id="semail"
              type="email"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              className="border-fg-line bg-fg-elevated"
            />
            {errors.email ? <p className="text-sm text-fg-danger-text">{errors.email}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="spass">Password</Label>
            <Input
              id="spass"
              type="password"
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              className="border-fg-line bg-fg-elevated"
            />
            {errors.password ? (
              <p className="text-sm text-fg-danger-text">{errors.password}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as StaffRole)}>
              <SelectTrigger className="border-fg-line bg-fg-elevated">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-fg-line bg-fg-elevated text-fg-ink">
                <SelectItem value={StaffRole.STAFF}>STAFF</SelectItem>
                <SelectItem value={StaffRole.SUPERVISOR}>SUPERVISOR</SelectItem>
                <SelectItem value={StaffRole.ADMIN}>ADMIN</SelectItem>
                <SelectItem value={StaffRole.PLATFORM_ADMIN}>PLATFORM ADMIN</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" className="border-fg-line" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" className="bg-fg-gold text-fg-black hover:bg-fg-gold/90" disabled={loading}>
              {loading ? "Creating…" : "Create user"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
