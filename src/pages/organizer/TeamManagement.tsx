import { useMemo, useState, type ChangeEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  MoreHorizontal,
  RefreshCw,
  Search,
  UserPlus,
  Users,
} from "lucide-react";
import { listEmployees } from "../../services/profiles";
import { setEmployeeActive } from "../../services/teamAdmin";
import { useAuth } from "../../contexts/AuthContext";
import type { EmployeeRow } from "../../types";
import { roleLabel } from "../../utils/roles";
import { cn } from "../../utils/cn";
import { InviteEmployeeDialog } from "../../features/organizer/InviteEmployeeDialog";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Avatar } from "../../components/ui/avatar";
import { Input } from "../../components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { Skeleton } from "../../components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "../../components/ui/dropdown-menu";
import { EmptyState } from "../../components/ui/empty-state";
import { ConfirmDialog } from "../../components/ui/confirm-dialog";
import { PageHeader } from "../../components/ui/page-header";
import { toast } from "../../components/ui/toaster";

export default function TeamManagement() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<EmployeeRow | null>(null);
  const [confirming, setConfirming] = useState(false);

  const employeesQuery = useQuery({
    queryKey: ["employees"],
    queryFn: listEmployees,
  });

  const employees = useMemo(
    () => employeesQuery.data ?? [],
    [employeesQuery.data],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        e.full_name.toLowerCase().includes(q) ||
        (e.username ?? "").toLowerCase().includes(q),
    );
  }, [employees, search]);

  const handleConfirm = async () => {
    if (!confirmTarget) return;
    const target = confirmTarget;
    const nextActive = !target.is_active;
    setConfirming(true);
    try {
      await setEmployeeActive(target.id, nextActive);
      toast.success(
        nextActive
          ? `${target.full_name} is now active.`
          : `${target.full_name} has been deactivated.`,
      );
      await queryClient.invalidateQueries({ queryKey: ["employees"] });
      setConfirmTarget(null);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Could not update employee status. Please try again.",
      );
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Management"
        description="Invite employees and manage team access."
        actions={
          <Button variant="default" onClick={() => setInviteOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Invite employee
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Employees</CardTitle>
              <CardDescription>
                {employees.length}{" "}
                {employees.length === 1 ? "member" : "members"} in the
                organization.
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--fg-subtle)"
                aria-hidden="true"
              />
              <Input
                type="search"
                placeholder="Search by name or username…"
                aria-label="Search employees"
                value={search}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setSearch(e.target.value)
                }
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {employeesQuery.isLoading ? (
            <div className="space-y-3" aria-label="Loading employees">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          ) : employeesQuery.isError ? (
            <div
              className="flex flex-col items-center gap-3 rounded-xl border border-(--border) bg-(--surface-2) px-6 py-10 text-center"
              role="alert"
            >
              <p className="font-display text-sm font-semibold text-(--fg)">
                Could not load the team directory.
              </p>
              <p className="text-sm text-(--fg-muted)">
                Check your connection and try again.
              </p>
              <Button
                variant="outline"
                onClick={() => employeesQuery.refetch()}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </div>
          ) : employees.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No team members yet"
              description="Invite your first employee to start building the team."
              action={
                <Button variant="default" onClick={() => setInviteOpen(true)}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Invite employee
                </Button>
              }
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No matches found"
              description={`No employees match "${search.trim()}".`}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((employee) => {
                    const isSelf = employee.id === user?.id;
                    return (
                      <TableRow
                        key={employee.id}
                        className={cn(!employee.is_active && "opacity-60")}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar
                              src={employee.avatar_url}
                              name={employee.full_name}
                            />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-(--fg)">
                                {employee.full_name}
                                {isSelf && (
                                  <span className="ml-2 text-xs font-normal text-(--fg-subtle)">
                                    (you)
                                  </span>
                                )}
                              </p>
                              <p className="truncate text-xs text-(--fg-subtle)">
                                @{employee.username ?? "—"}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-(--fg-muted)">
                          {employee.designation ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              employee.role === "organizer"
                                ? "volt"
                                : "default"
                            }
                          >
                            {roleLabel(employee.role)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              employee.is_active ? "success" : "muted"
                            }
                          >
                            {employee.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-(--fg-muted)">
                          {format(new Date(employee.created_at), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu
                            label={`Actions for ${employee.full_name}`}
                            trigger={
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Actions for ${employee.full_name}`}
                                title={
                                  isSelf
                                    ? "You cannot change your own status"
                                    : undefined
                                }
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            }
                          >
                            <DropdownMenuLabel>
                              Employee actions
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              disabled={isSelf}
                              danger={employee.is_active}
                              onSelect={() => setConfirmTarget(employee)}
                            >
                              {employee.is_active
                                ? "Deactivate"
                                : "Activate"}
                            </DropdownMenuItem>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <InviteEmployeeDialog open={inviteOpen} onOpenChange={setInviteOpen} />

      <ConfirmDialog
        open={confirmTarget !== null}
        onOpenChange={(open: boolean) => {
          if (!open && !confirming) setConfirmTarget(null);
        }}
        title={
          confirmTarget?.is_active
            ? `Deactivate ${confirmTarget?.full_name}?`
            : `Activate ${confirmTarget?.full_name}?`
        }
        description={
          confirmTarget?.is_active
            ? "They will lose access immediately and won't be able to sign in until reactivated."
            : "They will regain access and be able to sign in again."
        }
        confirmLabel={confirmTarget?.is_active ? "Deactivate" : "Activate"}
        variant={confirmTarget?.is_active ? "danger" : "default"}
        loading={confirming}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
