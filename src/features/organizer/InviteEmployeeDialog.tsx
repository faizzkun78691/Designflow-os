import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { inviteEmployee } from "../../services/teamAdmin";
import { ROLE_LABELS } from "../../utils/roles";
import type { AppRole } from "../../types";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select } from "../../components/ui/select";
import { toast } from "../../components/ui/toaster";

const ROLE_VALUES = [
  "organizer",
  "team_lead",
  "designer",
  "social_media_manager",
] as const;

const inviteSchema = z.object({
  full_name: z.string().trim().min(2, "Name must be at least 2 characters."),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]{3,30}$/, "3-30 lowercase letters/digits."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  designation: z
    .string()
    .trim()
    .min(2, "Designation must be at least 2 characters."),
  role: z.enum(ROLE_VALUES),
});

type InviteFormValues = z.infer<typeof inviteSchema>;

interface InviteEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteEmployeeDialog({
  open,
  onOpenChange,
}: InviteEmployeeDialogProps) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { role: "designer" },
  });

  const onSubmit = async (values: InviteFormValues) => {
    try {
      await inviteEmployee(values);
      toast.success(`Account created for @${values.username}`);
      await queryClient.invalidateQueries({ queryKey: ["employees"] });
      onOpenChange(false);
      reset();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Could not create the account. Please try again.",
      );
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create employee account</DialogTitle>
          <DialogDescription>
            They'll sign in with their username and the password you set.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="invite-name">Full name</Label>
            <Input
              id="invite-name"
              placeholder="Ayesha Malik"
              autoComplete="name"
              {...register("full_name")}
            />
            {errors.full_name && (
              <p role="alert" className="text-xs text-red-400">
                {errors.full_name.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-username">Username</Label>
            <Input
              id="invite-username"
              placeholder="ayesha"
              autoComplete="username"
              {...register("username")}
            />
            {errors.username && (
              <p role="alert" className="text-xs text-red-400">
                {errors.username.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-password">Password</Label>
            <Input
              id="invite-password"
              type="password"
              placeholder="Min. 8 characters"
              autoComplete="new-password"
              {...register("password")}
            />
            {errors.password && (
              <p role="alert" className="text-xs text-red-400">
                {errors.password.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-designation">Designation</Label>
            <Input
              id="invite-designation"
              placeholder="Senior Designer"
              {...register("designation")}
            />
            {errors.designation && (
              <p role="alert" className="text-xs text-red-400">
                {errors.designation.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-role">Role</Label>
            <Select id="invite-role" {...register("role")}>
              {(ROLE_VALUES as readonly AppRole[]).map((value) => (
                <option key={value} value={value}>
                  {ROLE_LABELS[value]}
                </option>
              ))}
            </Select>
            {errors.role && (
              <p role="alert" className="text-xs text-red-400">
                {errors.role.message}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" variant="default" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
