"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, MessageSquare, RefreshCw, Search, Send, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

const MAX_SMS_LENGTH = 160;

type RecipientMode = "direct" | "employees";

type SmsTarget = {
  id: string;
  name: string;
  contactNumber: string;
  position: string;
  office: string;
};

type SmsLogRow = {
  id: string;
  employeeName: string | null;
  phoneNumber: string;
  message: string;
  senderId: string | null;
  status: "SENT" | "FAILED";
  errorMessage: string | null;
  providerMessageId: string | null;
  createdAt: string;
};

type SendResult = {
  employeeId: string | null;
  employeeName: string | null;
  phoneNumber: string | null;
  normalizedPhoneNumber: string | null;
  status: "SENT" | "FAILED";
  errorMessage: string | null;
  providerMessageId: string | null;
};

type SendSummary = {
  total: number;
  sent: number;
  failed: number;
  results: SendResult[];
};

type SmsToolProps = {
  departmentId: string;
  defaultSenderId: string;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

async function parseError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error || fallback;
  } catch {
    return fallback;
  }
}

export default function SmsTool({ departmentId, defaultSenderId }: SmsToolProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState<RecipientMode>("direct");
  const [targets, setTargets] = useState<SmsTarget[]>([]);
  const [logs, setLogs] = useState<SmsLogRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [message, setMessage] = useState("");
  const [senderId, setSenderId] = useState(defaultSenderId);
  const [loadingTargets, setLoadingTargets] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [sending, setSending] = useState(false);
  const [summary, setSummary] = useState<SendSummary | null>(null);

  const loadTargets = useCallback(async () => {
    setLoadingTargets(true);
    try {
      const response = await fetch(`/api/${departmentId}/sms/targets`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(await parseError(response, "Unable to load SMS targets."));
      }
      const body = (await response.json()) as { employees: SmsTarget[] };
      setTargets(body.employees);
    } catch (error) {
      toast({
        title: "Unable to load recipients",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingTargets(false);
    }
  }, [departmentId, toast]);

  const loadLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const response = await fetch(`/api/${departmentId}/sms/logs?limit=10`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(await parseError(response, "Unable to load SMS logs."));
      }
      const body = (await response.json()) as { logs: SmsLogRow[] };
      setLogs(body.logs);
    } catch (error) {
      toast({
        title: "Unable to load logs",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingLogs(false);
    }
  }, [departmentId, toast]);

  useEffect(() => {
    void loadTargets();
    void loadLogs();
  }, [loadTargets, loadLogs]);

  const filteredTargets = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return targets;

    return targets.filter((target) => {
      return [target.name, target.contactNumber, target.position, target.office]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [search, targets]);

  const selectedCount = selectedIds.length;
  const messageLength = message.trim().length;
  const canSend =
    !sending &&
    messageLength > 0 &&
    messageLength <= MAX_SMS_LENGTH &&
    (mode === "direct" ? phoneNumber.trim().length > 0 : selectedCount > 0);

  const toggleSelected = (employeeId: string) => {
    setSelectedIds((current) =>
      current.includes(employeeId)
        ? current.filter((id) => id !== employeeId)
        : [...current, employeeId]
    );
  };

  const selectVisible = () => {
    const visibleIds = filteredTargets.map((target) => target.id);
    setSelectedIds((current) => Array.from(new Set([...current, ...visibleIds])));
  };

  const clearSelected = () => setSelectedIds([]);

  const sendSms = async () => {
    if (!canSend) return;

    setSending(true);
    setSummary(null);
    try {
      const response = await fetch(`/api/${departmentId}/sms/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          senderId,
          ...(mode === "direct" ? { phoneNumber } : { employeeIds: selectedIds }),
        }),
      });

      if (!response.ok) {
        throw new Error(await parseError(response, "Unable to send SMS."));
      }

      const body = (await response.json()) as SendSummary;
      setSummary(body);
      toast({
        title: "SMS send completed",
        description: `${body.sent} sent, ${body.failed} failed.`,
      });
      await loadLogs();
    } catch (error) {
      toast({
        title: "SMS send failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
      <div className="space-y-6">
        <Card className="border-white/40 bg-white/70 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageSquare className="h-5 w-5 text-indigo-600" />
              Compose SMS
            </CardTitle>
            <CardDescription>
              Messages are sent through UniSMS and logged per recipient.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                type="button"
                variant={mode === "direct" ? "default" : "outline"}
                className="justify-start"
                onClick={() => setMode("direct")}
              >
                Direct number
              </Button>
              <Button
                type="button"
                variant={mode === "employees" ? "default" : "outline"}
                className="justify-start"
                onClick={() => setMode("employees")}
              >
                Select employees
                {selectedCount > 0 ? <Badge className="ml-auto">{selectedCount}</Badge> : null}
              </Button>
            </div>

            {mode === "direct" ? (
              <div className="space-y-2">
                <Label htmlFor="sms-phone">Phone number</Label>
                <Input
                  id="sms-phone"
                  value={phoneNumber}
                  onChange={(event) => setPhoneNumber(event.target.value)}
                  placeholder="09171234567 or +639171234567"
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="relative w-full sm:max-w-md">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      className="pl-9"
                      placeholder="Search name, number, office, position"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={selectVisible}>
                      Select visible
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={clearSelected}>
                      Clear
                    </Button>
                  </div>
                </div>

                <div className="max-h-80 overflow-auto rounded-md border bg-white">
                  {loadingTargets ? (
                    <div className="flex items-center gap-2 p-4 text-sm text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading recipients...
                    </div>
                  ) : filteredTargets.length === 0 ? (
                    <div className="p-4 text-sm text-slate-500">No matching employees with contact numbers.</div>
                  ) : (
                    <div className="divide-y">
                      {filteredTargets.map((target) => {
                        const checked = selectedIds.includes(target.id);
                        return (
                          <button
                            key={target.id}
                            type="button"
                            className={cn(
                              "flex w-full items-start gap-3 p-3 text-left transition-colors hover:bg-slate-50",
                              checked && "bg-indigo-50"
                            )}
                            onClick={() => toggleSelected(target.id)}
                          >
                            <Checkbox checked={checked} className="mt-1" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-slate-900">
                                {target.name}
                              </span>
                              <span className="block truncate text-xs text-slate-500">
                                {target.contactNumber} {target.office ? `- ${target.office}` : ""}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="sms-sender">Sender ID</Label>
              <Input
                id="sms-sender"
                value={senderId}
                onChange={(event) => setSenderId(event.target.value)}
                placeholder="Default sender from UNISMS_SENDER_ID"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="sms-message">Message</Label>
                <span
                  className={cn(
                    "text-xs font-medium",
                    messageLength > MAX_SMS_LENGTH ? "text-red-600" : "text-slate-500"
                  )}
                >
                  {messageLength}/{MAX_SMS_LENGTH}
                </span>
              </div>
              <Textarea
                id="sms-message"
                rows={7}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Type the SMS content..."
              />
            </div>

            <Button type="button" disabled={!canSend} onClick={sendSms} className="w-full sm:w-auto">
              {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Send SMS
            </Button>
          </CardContent>
        </Card>

        {summary ? (
          <Card className="border-white/40 bg-white/70 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Send result</CardTitle>
              <CardDescription>
                {summary.sent} sent, {summary.failed} failed, {summary.total} total.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {summary.results.map((result, index) => (
                  <div
                    key={`${result.normalizedPhoneNumber ?? result.phoneNumber ?? "recipient"}-${index}`}
                    className="flex items-start gap-3 rounded-md border bg-white p-3"
                  >
                    {result.status === "SENT" ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                    ) : (
                      <XCircle className="mt-0.5 h-4 w-4 text-red-600" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {result.employeeName ?? result.normalizedPhoneNumber ?? result.phoneNumber ?? "Recipient"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {result.status === "SENT"
                          ? result.providerMessageId
                            ? `Provider ID: ${result.providerMessageId}`
                            : "Sent"
                          : result.errorMessage ?? "Failed"}
                      </p>
                    </div>
                    <Badge variant={result.status === "SENT" ? "default" : "destructive"}>
                      {result.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <Card className="border-white/40 bg-white/70 shadow-sm">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Recent logs</CardTitle>
              <CardDescription>Latest SMS attempts in this department.</CardDescription>
            </div>
            <Button type="button" variant="outline" size="icon" onClick={loadLogs} disabled={loadingLogs}>
              <RefreshCw className={cn("h-4 w-4", loadingLogs && "animate-spin")} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingLogs ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading logs...
            </div>
          ) : logs.length === 0 ? (
            <p className="text-sm text-slate-500">No SMS logs yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent at</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="max-w-[220px]">
                      <div className="truncate font-medium">
                        {log.employeeName ?? log.phoneNumber}
                      </div>
                      <div className="truncate text-xs text-slate-500">
                        {log.errorMessage ?? log.message}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={log.status === "SENT" ? "default" : "destructive"}>
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-slate-500">
                      {formatDateTime(log.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
