import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { AuthGuard } from "@/components/RoleGuard";
import { Shell } from "@/components/Shell";
import { ConfirmDialog, type ConfirmDialogState } from "@/components/ConfirmDialog";
import { api } from "@/lib/api";
import { Copy, Loader2, Plus, RefreshCw, Save, Shield, Ticket, Trash2 } from "lucide-react";

export const Route = createFileRoute("/admin")({
  component: () => (
    <AuthGuard roles={["admin"]}>
      <Shell>
        <AdminPage />
      </Shell>
    </AuthGuard>
  ),
});

const UFS = ["PE", "BA", "CE", "RJ", "SP"];

function AdminPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [bases, setBases] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingBase, setSavingBase] = useState(false);
  const [createdInviteCode, setCreatedInviteCode] = useState("");
  const [confirmState, setConfirmState] = useState<ConfirmDialogState | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [newBase, setNewBase] = useState({
    id: "",
    name: "",
    city: "",
    uf: "PE",
    latitude: "",
    longitude: "",
    coverage_cities: "",
  });
  const [newInvite, setNewInvite] = useState({
    role: "operador",
    base_id: "",
    uf_scope: "PE",
    expires_in_hours: 72,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [loadedUsers, loadedBases, loadedInvites] = await Promise.all([
        api<any[]>("/users").catch(() => []),
        api<any[]>("/bases").catch(() => []),
        api<any[]>("/invites").catch(() => []),
      ]);
      setUsers(Array.isArray(loadedUsers) ? loadedUsers : []);
      setBases(Array.isArray(loadedBases) ? loadedBases : []);
      setInvites(Array.isArray(loadedInvites) ? loadedInvites : []);
      if (Array.isArray(loadedBases) && loadedBases[0]?.id) {
        setNewInvite((prev) => ({
          ...prev,
          base_id: prev.base_id || loadedBases[0].id,
          uf_scope: prev.uf_scope || loadedBases[0].uf || "PE",
        }));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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

  const updateUser = async (user: any) => {
    const payload =
      user.role === "admin"
        ? { role: "admin", base_id: null, uf_scope: null }
        : user.role === "comandante"
          ? { role: "comandante", base_id: null, uf_scope: user.uf_scope || "PE" }
          : {
              role: "operador",
              base_id: user.base_id || user.profile?.base_id || bases[0]?.id,
              uf_scope: null,
            };

    setConfirmState({
      title: "Atualizar acesso",
      description: `Salvar o escopo de acesso de ${user.username}?`,
      confirmLabel: "Salvar acesso",
      variant: "warning",
      onConfirm: async () => {
        await api(`/users/${encodeURIComponent(user.username)}/role`, {
          method: "PATCH",
          json: payload,
        });
        load();
      },
    });
  };

  const createInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatedInviteCode("");
    const payload =
      newInvite.role === "admin"
        ? { role: "admin", base_id: null, uf_scope: null }
        : newInvite.role === "comandante"
          ? { role: "comandante", base_id: null, uf_scope: newInvite.uf_scope }
          : { role: "operador", base_id: newInvite.base_id, uf_scope: null };

    try {
      const res = await api<any>("/invites", {
        method: "POST",
        json: {
          ...payload,
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
    setConfirmState({
      title: "Revogar convite",
      description: `O convite para ${invite.role} sera invalidado.`,
      confirmLabel: "Revogar",
      variant: "warning",
      onConfirm: async () => {
        await api(`/invites/${encodeURIComponent(invite.id)}`, { method: "DELETE" });
        load();
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
          uf: newBase.uf,
          latitude: parseOptionalNumber(newBase.latitude),
          longitude: parseOptionalNumber(newBase.longitude),
          coverage_cities: parseCities(newBase.coverage_cities),
        },
      });
      setNewBase({
        id: "",
        name: "",
        city: "",
        uf: "PE",
        latitude: "",
        longitude: "",
        coverage_cities: "",
      });
      load();
    } catch (e: any) {
      alert(e?.message || "Falha ao criar base");
    } finally {
      setSavingBase(false);
    }
  };

  const updateBase = async (base: any) => {
    await api(`/bases/${encodeURIComponent(base.id)}`, {
      method: "PATCH",
      json: {
        name: base.name,
        city: base.city,
        uf: base.uf || "PE",
        latitude: parseOptionalNumber(base.latitude),
        longitude: parseOptionalNumber(base.longitude),
        coverage_cities: parseCities(base.coverage_cities_text || base.coverage_cities || []),
      },
    });
    load();
  };

  const deleteBase = async (base: any) => {
    setConfirmState({
      title: "Excluir base",
      description: `A base ${base.name || base.id} sera removida do cadastro.`,
      confirmLabel: "Excluir base",
      variant: "danger",
      onConfirm: async () => {
        await api(`/bases/${encodeURIComponent(base.id)}`, { method: "DELETE" });
        load();
      },
    });
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
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-md border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <div>
                <div className="text-sm font-semibold">Gestao de Usuarios</div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Admin global, comandante por UF, operador por base
                </div>
              </div>
            </div>
            <button
              onClick={load}
              className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted-foreground hover:text-foreground"
              title="Atualizar"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
          {loading ? (
            <div className="grid place-items-center p-6 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 text-left">Usuario</th>
                    <th className="px-3 py-2 text-left">Nome</th>
                    <th className="px-3 py-2 text-left">Papel</th>
                    <th className="px-3 py-2 text-left">Escopo</th>
                    <th className="px-3 py-2 text-right">Acao</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr
                      key={user.username}
                      className="border-b border-border/60 hover:bg-surface-2"
                    >
                      <td className="px-3 py-2 font-mono text-xs">{user.username}</td>
                      <td className="px-3 py-2">
                        {user.display_name || user.profile?.display_name || "-"}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={user.role}
                          onChange={(e) =>
                            setUsers((prev) =>
                              prev.map((item) =>
                                item.username === user.username
                                  ? { ...item, role: e.target.value }
                                  : item,
                              ),
                            )
                          }
                          className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                        >
                          <option value="operador">operador</option>
                          <option value="comandante">comandante</option>
                          <option value="admin">admin</option>
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        {user.role === "admin" ? (
                          <span className="text-xs text-muted-foreground">Global</span>
                        ) : user.role === "comandante" ? (
                          <UfSelect
                            value={user.uf_scope || "PE"}
                            onChange={(uf) =>
                              setUsers((prev) =>
                                prev.map((item) =>
                                  item.username === user.username
                                    ? { ...item, uf_scope: uf }
                                    : item,
                                ),
                              )
                            }
                          />
                        ) : (
                          <select
                            value={user.base_id || user.profile?.base_id || ""}
                            onChange={(e) =>
                              setUsers((prev) =>
                                prev.map((item) =>
                                  item.username === user.username
                                    ? { ...item, base_id: e.target.value }
                                    : item,
                                ),
                              )
                            }
                            className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                          >
                            <option value="">Selecione...</option>
                            {bases.map((base) => (
                              <option key={base.id} value={base.id}>
                                {base.name || base.id}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => updateUser(user)}
                          className="inline-flex items-center gap-1 rounded-md border border-primary/40 px-2 py-1 text-xs font-semibold text-primary"
                        >
                          <Save className="h-3.5 w-3.5" /> Salvar
                        </button>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-xs text-muted-foreground">
                        Nenhum usuario.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <section className="rounded-md border border-border bg-surface p-4">
            <PanelTitle
              icon={<Ticket className="h-4 w-4" />}
              title="Convites"
              subtitle="Cadastro fechado por codigo unico"
            />
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
                value={newInvite.role}
                onChange={(e) => setNewInvite({ ...newInvite, role: e.target.value })}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
              >
                <option value="operador">operador</option>
                <option value="comandante">comandante</option>
                <option value="admin">admin</option>
              </select>
              {newInvite.role === "operador" && (
                <select
                  required
                  value={newInvite.base_id}
                  onChange={(e) => setNewInvite({ ...newInvite, base_id: e.target.value })}
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                >
                  <option value="">Base do operador</option>
                  {bases.map((base) => (
                    <option key={base.id} value={base.id}>
                      {base.name || base.id}
                    </option>
                  ))}
                </select>
              )}
              {newInvite.role === "comandante" && (
                <UfSelect
                  value={newInvite.uf_scope}
                  onChange={(uf) => setNewInvite({ ...newInvite, uf_scope: uf })}
                  className="w-full"
                />
              )}
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
              {invites.map((invite) => {
                const used = Boolean(invite.used_by);
                const revoked = Boolean(invite.revoked_at);
                return (
                  <li key={invite.id} className="rounded border border-border bg-background p-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-mono uppercase tracking-wide text-muted-foreground">
                          {invite.role} - {invite.uf_scope || invite.base_id || "global"}
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
              {invites.length === 0 && (
                <li className="text-muted-foreground">Nenhum convite ativo.</li>
              )}
            </ul>
          </section>

          <section className="rounded-md border border-border bg-surface p-4">
            <PanelTitle title={`Bases (${bases.length})`} subtitle="Bases operacionais por UF" />
            <ul className="mb-3 space-y-2 text-sm">
              {bases.map((base) => (
                <li key={base.id} className="rounded border border-border bg-background p-2">
                  <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {base.id}
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-1">
                    <input
                      value={base.name || ""}
                      onChange={(e) => updateBaseDraft(setBases, base.id, { name: e.target.value })}
                      className="rounded border border-border bg-surface px-2 py-1 text-xs"
                    />
                    <button
                      onClick={() => updateBase(base)}
                      className="grid h-7 w-7 place-items-center rounded border border-border text-primary"
                      title="Salvar base"
                    >
                      <Save className="h-3.5 w-3.5" />
                    </button>
                    <input
                      value={base.city || ""}
                      onChange={(e) => updateBaseDraft(setBases, base.id, { city: e.target.value })}
                      className="rounded border border-border bg-surface px-2 py-1 text-xs"
                    />
                    <UfSelect
                      value={base.uf || "PE"}
                      onChange={(uf) => updateBaseDraft(setBases, base.id, { uf })}
                    />
                    <div className="col-span-2 grid grid-cols-2 gap-1">
                      <input
                        value={base.latitude ?? ""}
                        onChange={(e) =>
                          updateBaseDraft(setBases, base.id, { latitude: e.target.value })
                        }
                        placeholder="Latitude"
                        className="rounded border border-border bg-surface px-2 py-1 text-xs"
                      />
                      <input
                        value={base.longitude ?? ""}
                        onChange={(e) =>
                          updateBaseDraft(setBases, base.id, { longitude: e.target.value })
                        }
                        placeholder="Longitude"
                        className="rounded border border-border bg-surface px-2 py-1 text-xs"
                      />
                    </div>
                    <textarea
                      value={
                        base.coverage_cities_text ??
                        (Array.isArray(base.coverage_cities) ? base.coverage_cities.join(", ") : "")
                      }
                      onChange={(e) =>
                        updateBaseDraft(setBases, base.id, { coverage_cities_text: e.target.value })
                      }
                      placeholder="Cidades cobertas, separadas por virgula"
                      rows={2}
                      className="col-span-2 rounded border border-border bg-surface px-2 py-1 text-xs"
                    />
                    <button
                      onClick={() => deleteBase(base)}
                      className="col-span-2 inline-flex items-center justify-center gap-1 rounded border border-destructive/40 px-2 py-1 text-xs text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Excluir base
                    </button>
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
                className={inputClass}
              />
              <input
                required
                placeholder="Nome"
                value={newBase.name}
                onChange={(e) => setNewBase({ ...newBase, name: e.target.value })}
                className={inputClass}
              />
              <div className="grid grid-cols-[minmax(0,1fr)_80px] gap-2">
                <input
                  required
                  placeholder="Cidade"
                  value={newBase.city}
                  onChange={(e) => setNewBase({ ...newBase, city: e.target.value })}
                  className={inputClass}
                />
                <UfSelect value={newBase.uf} onChange={(uf) => setNewBase({ ...newBase, uf })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  placeholder="Latitude"
                  value={newBase.latitude}
                  onChange={(e) => setNewBase({ ...newBase, latitude: e.target.value })}
                  className={inputClass}
                />
                <input
                  placeholder="Longitude"
                  value={newBase.longitude}
                  onChange={(e) => setNewBase({ ...newBase, longitude: e.target.value })}
                  className={inputClass}
                />
              </div>
              <textarea
                placeholder="Cidades cobertas: Recife, Olinda, Paulista..."
                value={newBase.coverage_cities}
                onChange={(e) => setNewBase({ ...newBase, coverage_cities: e.target.value })}
                rows={3}
                className={inputClass}
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
        </aside>
      </div>
    </div>
  );
}

const inputClass = "w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs";

function UfSelect({
  value,
  onChange,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <select
      value={value || "PE"}
      onChange={(e) => onChange(e.target.value)}
      className={`rounded-md border border-border bg-background px-2 py-1.5 text-xs ${className}`}
    >
      {UFS.map((uf) => (
        <option key={uf} value={uf}>
          {uf}
        </option>
      ))}
    </select>
  );
}

function PanelTitle({
  icon,
  title,
  subtitle,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      {icon && <div className="text-primary">{icon}</div>}
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{title}</div>
        {subtitle && <div className="text-[11px] text-muted-foreground">{subtitle}</div>}
      </div>
    </div>
  );
}

function updateBaseDraft(
  setBases: React.Dispatch<React.SetStateAction<any[]>>,
  id: string,
  patch: Record<string, unknown>,
) {
  setBases((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
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
