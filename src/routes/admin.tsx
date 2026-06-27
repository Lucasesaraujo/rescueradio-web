import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { AuthGuard } from "@/components/RoleGuard";
import { Shell } from "@/components/Shell";
import { ConfirmDialog, type ConfirmDialogState } from "@/components/ConfirmDialog";
import { api } from "@/lib/api";
import { Loader2, Plus, Shield, RefreshCw, Save, Trash2, Ticket, Copy } from "lucide-react";

export const Route = createFileRoute("/admin")({
  component: () => (
    <AuthGuard roles={["admin"]}>
      <Shell>
        <AdminPage />
      </Shell>
    </AuthGuard>
  ),
});

function AdminPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [bases, setBases] = useState<any[]>([]);
  const [functions, setFunctions] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [newBase, setNewBase] = useState({
    id: "",
    name: "",
    city: "",
    latitude: "",
    longitude: "",
    coverage_cities: "",
  });
  const [newFunction, setNewFunction] = useState({ id: "", label: "" });
  const [newInvite, setNewInvite] = useState({
    base_id: "",
    role: "operador",
    expires_in_hours: 72,
  });
  const [createdInviteCode, setCreatedInviteCode] = useState("");
  const [savingBase, setSavingBase] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmDialogState | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, b, f, i] = await Promise.all([
        api<any[]>("/users").catch(() => []),
        api<any[]>("/bases").catch(() => []),
        api<any[]>("/functions").catch(() => []),
        api<any[]>("/invites").catch(() => []),
      ]);
      setUsers(Array.isArray(u) ? u : []);
      setBases(Array.isArray(b) ? b : []);
      setFunctions(Array.isArray(f) ? f : []);
      setInvites(Array.isArray(i) ? i : []);
      if (Array.isArray(b) && b[0]?.id) {
        setNewInvite((prev) => (prev.base_id ? prev : { ...prev, base_id: b[0].id }));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const updateBase = async (base: any) => {
    try {
      await api(`/bases/${encodeURIComponent(base.id)}`, {
        method: "PATCH",
        json: {
          name: base.name,
          city: base.city,
          latitude: parseOptionalNumber(base.latitude),
          longitude: parseOptionalNumber(base.longitude),
          coverage_cities: parseCities(base.coverage_cities_text || base.coverage_cities || []),
        },
      });
      load();
    } catch (e: any) {
      alert(e?.message || "Falha ao editar base");
    }
  };

  const requestConfirm = (state: ConfirmDialogState) => setConfirmState(state);

  const runConfirmedAction = async () => {
    if (!confirmState) return;
    setConfirmBusy(true);
    try {
      await confirmState.onConfirm();
      setConfirmState(null);
    } finally {
      setConfirmBusy(false);
    }
  };

  const deleteBase = async (base: any) => {
    requestConfirm({
      title: "Excluir base",
      description: `A base ${base.name || base.id} sera removida do cadastro. Essa acao nao pode ser desfeita.`,
      confirmLabel: "Excluir base",
      variant: "danger",
      onConfirm: async () => {
        try {
          await api(`/bases/${encodeURIComponent(base.id)}`, { method: "DELETE" });
          load();
        } catch (e: any) {
          alert(e?.message || "Falha ao excluir base");
        }
      },
    });
  };

  const createFunction = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api("/functions", { method: "POST", json: newFunction });
      setNewFunction({ id: "", label: "" });
      load();
    } catch (e: any) {
      alert(e?.message || "Falha ao criar funcao");
    }
  };

  const createInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatedInviteCode("");
    try {
      const res = await api<any>("/invites", {
        method: "POST",
        json: {
          base_id: newInvite.base_id,
          role: newInvite.role,
          expires_in_hours: Number(newInvite.expires_in_hours) || 72,
        },
      });
      setCreatedInviteCode(res.code || "");
      load();
    } catch (e: any) {
      alert(e?.message || "Falha ao criar convite");
    }
  };

  const revokeInvite = async (invite: any) => {
    requestConfirm({
      title: "Revogar convite",
      description: `O convite para ${invite.role} na base ${invite.base_id} sera invalidado.`,
      confirmLabel: "Revogar",
      variant: "warning",
      onConfirm: async () => {
        try {
          await api(`/invites/${encodeURIComponent(invite.id)}`, { method: "DELETE" });
          load();
        } catch (e: any) {
          alert(e?.message || "Falha ao revogar convite");
        }
      },
    });
  };

  const updateFunction = async (fn: any) => {
    try {
      await api(`/functions/${encodeURIComponent(fn.id)}`, {
        method: "PATCH",
        json: { label: fn.label },
      });
      load();
    } catch (e: any) {
      alert(e?.message || "Falha ao editar funcao");
    }
  };

  const deleteFunction = async (fn: any) => {
    requestConfirm({
      title: "Excluir funcao",
      description: `A funcao ${fn.label || fn.id} deixara de aparecer nos cadastros de operador.`,
      confirmLabel: "Excluir funcao",
      variant: "danger",
      onConfirm: async () => {
        try {
          await api(`/functions/${encodeURIComponent(fn.id)}`, { method: "DELETE" });
          load();
        } catch (e: any) {
          alert(e?.message || "Falha ao excluir funcao");
        }
      },
    });
  };
  useEffect(() => {
    load();
  }, [load]);

  const updateRole = async (username: string, role: string) => {
    requestConfirm({
      title: "Alterar perfil de acesso",
      description: `O usuario ${username} passara a ter perfil ${role}.`,
      confirmLabel: "Alterar perfil",
      variant: "warning",
      onConfirm: async () => {
        try {
          await api(`/users/${encodeURIComponent(username)}/role`, {
            method: "PATCH",
            json: { role },
          });
          load();
        } catch (e: any) {
          alert(e?.message || "Falha ao alterar role");
        }
      },
    });
  };

  const createBase = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBase(true);
    try {
      await api("/bases", {
        method: "POST",
        json: {
          id: newBase.id,
          name: newBase.name,
          city: newBase.city,
          latitude: parseOptionalNumber(newBase.latitude),
          longitude: parseOptionalNumber(newBase.longitude),
          coverage_cities: parseCities(newBase.coverage_cities),
        },
      });
      setNewBase({ id: "", name: "", city: "", latitude: "", longitude: "", coverage_cities: "" });
      load();
    } catch (e: any) {
      alert(e?.message || "Falha ao criar base");
    } finally {
      setSavingBase(false);
    }
  };

  return (
    <div className="h-full overflow-auto p-4">
      <ConfirmDialog
        open={!!confirmState}
        state={confirmState}
        busy={confirmBusy}
        onCancel={() => !confirmBusy && setConfirmState(null)}
        onConfirm={runConfirmedAction}
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-md border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <div className="text-sm font-semibold">Usuarios</div>
            </div>
            <button
              onClick={load}
              className="grid h-7 w-7 place-items-center rounded-md border border-border text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
          {loading ? (
            <div className="grid place-items-center p-6 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando...
            </div>
          ) : users.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">Nenhum usuario.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 text-left">Usuario</th>
                    <th className="px-3 py-2 text-left">Nome</th>
                    <th className="px-3 py-2 text-left">Base</th>
                    <th className="px-3 py-2 text-left">Role</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.username} className="border-b border-border/60 hover:bg-surface-2">
                      <td className="px-3 py-2 font-mono text-xs">{u.username}</td>
                      <td className="px-3 py-2">{u.display_name || "-"}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {u.profile?.base_id || u.base_id || "-"}
                      </td>
                      <td className="px-3 py-2">
                        <span className="rounded border border-border bg-background px-2 py-0.5 text-xs uppercase">
                          {u.role}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <select
                          value={u.role}
                          onChange={(e) => updateRole(u.username, e.target.value)}
                          className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                        >
                          <option value="operador">operador</option>
                          <option value="comandante">comandante</option>
                          <option value="admin">admin</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <section className="rounded-md border border-border bg-surface p-4">
            <div className="mb-3 flex items-center gap-2">
              <Ticket className="h-4 w-4 text-primary" />
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Convites
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Cadastro fechado por codigo unico
                </div>
              </div>
            </div>
            {createdInviteCode && (
              <div className="mb-3 rounded-md border border-primary/40 bg-primary/10 p-2">
                <div className="mb-1 text-[10px] uppercase tracking-[0.18em] text-primary">
                  Codigo gerado
                </div>
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 break-all rounded bg-background px-2 py-1 text-xs">
                    {createdInviteCode}
                  </code>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(createdInviteCode)}
                    className="grid h-8 w-8 place-items-center rounded border border-border text-muted-foreground hover:text-primary"
                    title="Copiar convite"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
            <form onSubmit={createInvite} className="mb-3 space-y-2">
              <select
                required
                value={newInvite.base_id}
                onChange={(e) => setNewInvite({ ...newInvite, base_id: e.target.value })}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
              >
                <option value="">Selecione a base</option>
                {bases.map((base) => (
                  <option key={base.id} value={base.id}>
                    {base.name || base.nome || base.id}
                  </option>
                ))}
              </select>
              <select
                value={newInvite.role}
                onChange={(e) => setNewInvite({ ...newInvite, role: e.target.value })}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
              >
                <option value="operador">operador</option>
                <option value="comandante">comandante</option>
                <option value="admin">admin</option>
              </select>
              <input
                type="number"
                min={1}
                max={720}
                value={newInvite.expires_in_hours}
                onChange={(e) =>
                  setNewInvite({ ...newInvite, expires_in_hours: Number(e.target.value) })
                }
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                aria-label="Validade em horas"
              />
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
              >
                <Plus className="h-3.5 w-3.5" /> Gerar convite
              </button>
            </form>
            <ul className="max-h-56 space-y-2 overflow-y-auto text-xs">
              {invites.length === 0 && (
                <li className="text-muted-foreground">Nenhum convite ativo.</li>
              )}
              {invites.map((invite) => {
                const used = Boolean(invite.used_by);
                const revoked = Boolean(invite.revoked_at);
                return (
                  <li key={invite.id} className="rounded border border-border bg-background p-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-mono uppercase tracking-wide text-muted-foreground">
                          {invite.role} - {invite.base_id || "sem base"}
                        </div>
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          {used
                            ? `Usado por ${invite.used_by}`
                            : revoked
                              ? "Revogado"
                              : `Expira em ${formatDate(invite.expires_at)}`}
                        </div>
                      </div>
                      {!used && !revoked && (
                        <button
                          type="button"
                          onClick={() => revokeInvite(invite)}
                          className="grid h-7 w-7 place-items-center rounded border border-destructive/40 text-destructive"
                          title="Revogar convite"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="rounded-md border border-border bg-surface p-4">
            <div className="mb-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Bases ({bases.length})
            </div>
            <ul className="mb-3 space-y-2 text-sm">
              {bases.map((b) => (
                <li key={b.id} className="rounded border border-border bg-background p-2">
                  <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {b.id}
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-1">
                    <input
                      value={b.name || ""}
                      onChange={(e) =>
                        setBases((prev) =>
                          prev.map((item) =>
                            item.id === b.id ? { ...item, name: e.target.value } : item,
                          ),
                        )
                      }
                      className="rounded border border-border bg-surface px-2 py-1 text-xs"
                    />
                    <button
                      onClick={() => updateBase(b)}
                      className="grid h-7 w-7 place-items-center rounded border border-border text-primary"
                      title="Salvar base"
                    >
                      <Save className="h-3.5 w-3.5" />
                    </button>
                    <input
                      value={b.city || ""}
                      onChange={(e) =>
                        setBases((prev) =>
                          prev.map((item) =>
                            item.id === b.id ? { ...item, city: e.target.value } : item,
                          ),
                        )
                      }
                      className="rounded border border-border bg-surface px-2 py-1 text-xs"
                    />
                    <div className="col-span-2 grid grid-cols-2 gap-1">
                      <input
                        value={b.latitude ?? ""}
                        onChange={(e) =>
                          setBases((prev) =>
                            prev.map((item) =>
                              item.id === b.id ? { ...item, latitude: e.target.value } : item,
                            ),
                          )
                        }
                        placeholder="Latitude"
                        className="rounded border border-border bg-surface px-2 py-1 text-xs"
                      />
                      <input
                        value={b.longitude ?? ""}
                        onChange={(e) =>
                          setBases((prev) =>
                            prev.map((item) =>
                              item.id === b.id ? { ...item, longitude: e.target.value } : item,
                            ),
                          )
                        }
                        placeholder="Longitude"
                        className="rounded border border-border bg-surface px-2 py-1 text-xs"
                      />
                    </div>
                    <button
                      onClick={() => deleteBase(b)}
                      className="grid h-7 w-7 place-items-center rounded border border-destructive/40 text-destructive"
                      title="Excluir base"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <textarea
                      value={
                        b.coverage_cities_text ??
                        (Array.isArray(b.coverage_cities) ? b.coverage_cities.join(", ") : "")
                      }
                      onChange={(e) =>
                        setBases((prev) =>
                          prev.map((item) =>
                            item.id === b.id
                              ? { ...item, coverage_cities_text: e.target.value }
                              : item,
                          ),
                        )
                      }
                      placeholder="Cidades cobertas, separadas por virgula"
                      rows={2}
                      className="col-span-2 rounded border border-border bg-surface px-2 py-1 text-xs"
                    />
                  </div>
                </li>
              ))}
              {bases.length === 0 && (
                <li className="text-xs text-muted-foreground">Nenhuma base.</li>
              )}
            </ul>
            <form onSubmit={createBase} className="space-y-2">
              <input
                required
                placeholder="ID da base"
                value={newBase.id}
                onChange={(e) => setNewBase({ ...newBase, id: e.target.value })}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
              />
              <input
                required
                placeholder="Nome"
                value={newBase.name}
                onChange={(e) => setNewBase({ ...newBase, name: e.target.value })}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
              />
              <input
                required
                placeholder="Cidade"
                value={newBase.city}
                onChange={(e) => setNewBase({ ...newBase, city: e.target.value })}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  placeholder="Latitude"
                  value={newBase.latitude}
                  onChange={(e) => setNewBase({ ...newBase, latitude: e.target.value })}
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                />
                <input
                  placeholder="Longitude"
                  value={newBase.longitude}
                  onChange={(e) => setNewBase({ ...newBase, longitude: e.target.value })}
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                />
              </div>
              <textarea
                placeholder="Cidades cobertas: Recife, Olinda, Paulista..."
                value={newBase.coverage_cities}
                onChange={(e) => setNewBase({ ...newBase, coverage_cities: e.target.value })}
                rows={3}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
              />
              <button
                type="submit"
                disabled={savingBase}
                className="inline-flex w-full items-center justify-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" /> Criar base
              </button>
            </form>
          </section>

          <section className="rounded-md border border-border bg-surface p-4">
            <div className="mb-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Funcoes ({functions.length})
            </div>
            <ul className="mb-3 space-y-2 text-sm">
              {functions.map((fn) => (
                <li key={fn.id} className="rounded border border-border bg-background p-2">
                  <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {fn.id}
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-1">
                    <input
                      value={fn.label || ""}
                      onChange={(e) =>
                        setFunctions((prev) =>
                          prev.map((item) =>
                            item.id === fn.id ? { ...item, label: e.target.value } : item,
                          ),
                        )
                      }
                      className="rounded border border-border bg-surface px-2 py-1 text-xs"
                    />
                    <button
                      onClick={() => updateFunction(fn)}
                      className="grid h-7 w-7 place-items-center rounded border border-border text-primary"
                      title="Salvar funcao"
                    >
                      <Save className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => deleteFunction(fn)}
                      className="grid h-7 w-7 place-items-center rounded border border-destructive/40 text-destructive"
                      title="Excluir funcao"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <form onSubmit={createFunction} className="space-y-2">
              <input
                required
                placeholder="ID da funcao"
                value={newFunction.id}
                onChange={(e) => setNewFunction({ ...newFunction, id: e.target.value })}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
              />
              <input
                required
                placeholder="Nome da funcao"
                value={newFunction.label}
                onChange={(e) => setNewFunction({ ...newFunction, label: e.target.value })}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
              />
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
              >
                <Plus className="h-3.5 w-3.5" /> Criar funcao
              </button>
            </form>
          </section>
        </aside>
      </div>
    </div>
  );
}

function parseCities(input: string | string[]) {
  const raw = Array.isArray(input) ? input.join(",") : input;
  return raw
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseOptionalNumber(input: unknown) {
  if (input === undefined || input === null || input === "") return null;
  const value = Number(input);
  return Number.isFinite(value) ? value : null;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
