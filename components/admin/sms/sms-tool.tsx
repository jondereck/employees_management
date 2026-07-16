"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Inbox,
  Loader2,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  formatPhilippineMobileLocalInput,
  isValidPhilippineMobileLocal,
  toE164FromPhilippineLocal,
} from "@/lib/phone";
import { cn } from "@/lib/utils";

const MAX_SMS_LENGTH = 1600;
const UNISMS_MAX_SMS_LENGTH = 160;

type SmsProviderChoice = "smsgate" | "twilio" | "unisms";
type RecipientMode = "direct" | "employees";
type SmsStatus = "QUEUED" | "SENT" | "DELIVERED" | "FAILED" | "UNDELIVERED" | "RECEIVED";

const PROVIDER_OPTIONS: Array<{ value: SmsProviderChoice; label: string; hint: string }> = [
  { value: "smsgate", label: "SMSGate", hint: "Free Android SMS gateway (default). Dual SIM via SMSGATE_SIM_NUMBER." },
  { value: "twilio", label: "Twilio", hint: "Supports replies and delivery status" },
  { value: "unisms", label: "UniSMS", hint: "160-character messages" },
];

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
  provider: string;
  status: SmsStatus;
  errorMessage: string | null;
  providerMessageId: string | null;
  createdAt: string;
};

type SendResult = {
  employeeId: string | null;
  employeeName: string | null;
  phoneNumber: string | null;
  normalizedPhoneNumber: string | null;
  status: "QUEUED" | "SENT" | "FAILED";
  provider: string | null;
  errorMessage: string | null;
  providerMessageId: string | null;
};

type SendSummary = {
  total: number;
  sent: number;
  failed: number;
  results: SendResult[];
};

type InboxMessage = {
  id: string;
  direction: "inbound" | "outbound";
  phoneNumber: string;
  employeeName: string | null;
  message: string;
  status: string;
  provider: string;
  createdAt: string;
};

type InboxThread = {
  phoneNumber: string;
  employeeName: string | null;
  latestMessage: string;
  latestAt: string;
  latestDirection: "inbound" | "outbound";
  messages: InboxMessage[];
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

function estimateSegments(text: string) {
  const length = text.trim().length;
  if (length === 0) return 0;
  return length <= 160 ? 1 : Math.ceil(length / 153);
}

function statusVariant(status: string) {
  return status === "FAILED" || status === "UNDELIVERED" ? "destructive" : "default";
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
  const [threads, setThreads] = useState<InboxThread[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedThreadPhone, setSelectedThreadPhone] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [message, setMessage] = useState("");
  const [replyMessage, setReplyMessage] = useState("");
  const [senderId, setSenderId] = useState(defaultSenderId);
  const [provider, setProvider] = useState<SmsProviderChoice>("smsgate");
  const [loadingTargets, setLoadingTargets] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [loadingInbox, setLoadingInbox] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [summary, setSummary] = useState<SendSummary | null>(null);

  const loadTargets = useCallback(async () => {
    setLoadingTargets(true);
    try {
      const response = await fetch(`/api/${departmentId}/sms/targets`, { cache: "no-store" });
      if (!response.ok) throw new Error(await parseError(response, "Unable to load SMS targets."));
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
      const response = await fetch(`/api/${departmentId}/sms/logs?limit=20`, { cache: "no-store" });
      if (!response.ok) throw new Error(await parseError(response, "Unable to load SMS logs."));
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

  const loadInbox = useCallback(async () => {
    setLoadingInbox(true);
    try {
      const response = await fetch(`/api/${departmentId}/sms/inbox`, { cache: "no-store" });
      if (!response.ok) throw new Error(await parseError(response, "Unable to load inbox."));
      const body = (await response.json()) as { threads: InboxThread[] };
      setThreads(body.threads);
      setSelectedThreadPhone((current) => current ?? body.threads[0]?.phoneNumber ?? null);
    } catch (error) {
      toast({
        title: "Unable to load inbox",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingInbox(false);
    }
  }, [departmentId, toast]);

  useEffect(() => {
    void loadTargets();
    void loadLogs();
    void loadInbox();
  }, [loadTargets, loadLogs, loadInbox]);

  const filteredTargets = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return targets;
    return targets.filter((target) =>
      [target.name, target.contactNumber, target.position, target.office]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [search, targets]);

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.phoneNumber === selectedThreadPhone) ?? threads[0] ?? null,
    [selectedThreadPhone, threads]
  );
  const selectedCount = selectedIds.length;
  const messageLength = message.trim().length;
  const replyLength = replyMessage.trim().length;
  const providerMaxLength = provider === "unisms" ? UNISMS_MAX_SMS_LENGTH : MAX_SMS_LENGTH;
  const segmentCount = estimateSegments(message);
  const replySegmentCount = estimateSegments(replyMessage);
  const recipientCount = mode === "direct" ? 1 : selectedCount;
  const estimatedCredits = segmentCount * Math.max(recipientCount, 0);
  const canSend =
    !sending &&
    messageLength > 0 &&
    messageLength <= providerMaxLength &&
    (mode === "direct" ? isValidPhilippineMobileLocal(phoneNumber) : selectedCount > 0);
  const canReply = !sendingReply && !!selectedThread && replyLength > 0 && replyLength <= MAX_SMS_LENGTH;

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

  const sendSms = async () => {
    if (!canSend) return;
    setSending(true);
    setSummary(null);
    try {
      const directPhone =
        mode === "direct" ? toE164FromPhilippineLocal(phoneNumber) : null;
      if (mode === "direct" && (!directPhone || !directPhone.ok)) {
        throw new Error(directPhone && !directPhone.ok ? directPhone.error : "Invalid phone number.");
      }

      const response = await fetch(`/api/${departmentId}/sms/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          provider,
          ...(provider === "unisms" ? { senderId } : {}),
          ...(mode === "direct" && directPhone?.ok
            ? { phoneNumber: directPhone.value }
            : { employeeIds: selectedIds }),
        }),
      });

      if (!response.ok) throw new Error(await parseError(response, "Unable to send SMS."));
      const body = (await response.json()) as SendSummary;
      setSummary(body);
      toast({
        title: "SMS send completed",
        description: `${body.sent} queued/sent, ${body.failed} failed.`,
      });
      await Promise.all([loadLogs(), loadInbox()]);
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

  const sendReply = async () => {
    if (!canReply || !selectedThread) return;
    setSendingReply(true);
    try {
      const response = await fetch(`/api/${departmentId}/sms/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: selectedThread.phoneNumber,
          message: replyMessage,
        }),
      });

      if (!response.ok) throw new Error(await parseError(response, "Unable to send reply."));
      setReplyMessage("");
      toast({ title: "Reply queued", description: `Reply sent to ${selectedThread.phoneNumber}.` });
      await Promise.all([loadLogs(), loadInbox()]);
    } catch (error) {
      toast({
        title: "Reply failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSendingReply(false);
    }
  };

  return (
    <Tabs defaultValue="compose" className="space-y-6">
      <TabsList className="grid w-full max-w-lg grid-cols-3">
        <TabsTrigger value="compose">Compose</TabsTrigger>
        <TabsTrigger value="logs">Logs</TabsTrigger>
        <TabsTrigger value="inbox">Inbox</TabsTrigger>
      </TabsList>

      <TabsContent value="compose" className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
          <div className="space-y-6">
            <Card className="border-white/40 bg-white/70 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MessageSquare className="h-5 w-5 text-indigo-600" />
                  Compose SMS
                </CardTitle>
                <CardDescription>
                  Choose a provider per blast. Default is SMSGate (free Android gateway). Inbox and replies remain Twilio-only.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="sms-provider">SMS provider</Label>
                  <Select
                    value={provider}
                    onValueChange={(value) => setProvider(value as SmsProviderChoice)}
                  >
                    <SelectTrigger id="sms-provider">
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVIDER_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500">
                    {PROVIDER_OPTIONS.find((option) => option.value === provider)?.hint}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Button type="button" variant={mode === "direct" ? "default" : "outline"} className="justify-start" onClick={() => setMode("direct")}>
                    Direct number
                  </Button>
                  <Button type="button" variant={mode === "employees" ? "default" : "outline"} className="justify-start" onClick={() => setMode("employees")}>
                    Select employees
                    {selectedCount > 0 ? <Badge className="ml-auto">{selectedCount}</Badge> : null}
                  </Button>
                </div>

                {mode === "direct" ? (
                  <div className="space-y-2">
                    <Label htmlFor="sms-phone">Phone number</Label>
                    <div className="flex overflow-hidden rounded-md border border-input bg-white shadow-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                      <span className="inline-flex select-none items-center border-r bg-slate-50 px-3 text-sm font-medium text-slate-600">
                        +63
                      </span>
                      <Input
                        id="sms-phone"
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel-national"
                        value={phoneNumber}
                        onChange={(event) =>
                          setPhoneNumber(formatPhilippineMobileLocalInput(event.target.value))
                        }
                        onPaste={(event) => {
                          event.preventDefault();
                          const pasted = event.clipboardData.getData("text");
                          setPhoneNumber(formatPhilippineMobileLocalInput(pasted));
                        }}
                        className="border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                        placeholder=""
                        maxLength={10}
                        aria-invalid={phoneNumber.length > 0 && !isValidPhilippineMobileLocal(phoneNumber)}
                      />
                    </div>
                    <p
                      className={cn(
                        "text-xs",
                        phoneNumber.length > 0 && !isValidPhilippineMobileLocal(phoneNumber)
                          ? "text-red-600"
                          : "text-slate-500"
                      )}
                    >
                      {phoneNumber.length > 0 && !isValidPhilippineMobileLocal(phoneNumber)
                        ? "Enter 10 digits starting with 9"
                        : "PH mobile only."}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="relative w-full sm:max-w-md">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Search name, number, office, position" />
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={selectVisible}>Select visible</Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedIds([])}>Clear</Button>
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
                              <button key={target.id} type="button" className={cn("flex w-full items-start gap-3 p-3 text-left transition-colors hover:bg-slate-50", checked && "bg-indigo-50")} onClick={() => toggleSelected(target.id)}>
                                <Checkbox checked={checked} className="mt-1" />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-semibold text-slate-900">{target.name}</span>
                                  <span className="block truncate text-xs text-slate-500">{target.contactNumber} {target.office ? `- ${target.office}` : ""}</span>
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {provider === "unisms" ? (
                  <div className="space-y-2">
                    <Label htmlFor="sms-sender">UniSMS Sender ID</Label>
                    <Input id="sms-sender" value={senderId} onChange={(event) => setSenderId(event.target.value)} placeholder="Optional sender ID" />
                  </div>
                ) : null}

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="sms-message">Message</Label>
                    <span className={cn("text-xs font-medium", messageLength > providerMaxLength ? "text-red-600" : "text-slate-500")}>
                      {messageLength}/{providerMaxLength}
                    </span>
                  </div>
                  <Textarea id="sms-message" rows={7} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Type the SMS content..." />
                  <p className="text-xs text-slate-500">
                    Estimated {segmentCount || 0} SMS segment{segmentCount === 1 ? "" : "s"} per recipient. Estimated total: {estimatedCredits || 0}.
                    {provider === "unisms"
                      ? ` UniSMS allows up to ${providerMaxLength} characters.`
                      : null}
                  </p>
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
                  <CardDescription>{summary.sent} queued/sent, {summary.failed} failed, {summary.total} total.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {summary.results.map((result, index) => (
                      <div key={`${result.normalizedPhoneNumber ?? result.phoneNumber ?? "recipient"}-${index}`} className="flex items-start gap-3 rounded-md border bg-white p-3">
                        {result.status === "FAILED" ? <XCircle className="mt-0.5 h-4 w-4 text-red-600" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{result.employeeName ?? result.normalizedPhoneNumber ?? result.phoneNumber ?? "Recipient"}</p>
                          <p className="text-xs text-slate-500">
                            {result.status === "FAILED" ? result.errorMessage ?? "Failed" : `${result.provider ?? "provider"} ${result.providerMessageId ?? result.status}`}
                          </p>
                        </div>
                        <Badge variant={statusVariant(result.status)}>{result.status}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>

          <RecentLogsCard logs={logs} loadingLogs={loadingLogs} onRefresh={loadLogs} />
        </div>
      </TabsContent>

      <TabsContent value="logs">
        <RecentLogsCard logs={logs} loadingLogs={loadingLogs} onRefresh={loadLogs} />
      </TabsContent>

      <TabsContent value="inbox">
        <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
          <Card className="border-white/40 bg-white/70 shadow-sm">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Inbox className="h-5 w-5 text-indigo-600" />
                    Inbox
                  </CardTitle>
                  <CardDescription>Replies received through Twilio.</CardDescription>
                </div>
                <Button type="button" variant="outline" size="icon" onClick={loadInbox} disabled={loadingInbox}>
                  <RefreshCw className={cn("h-4 w-4", loadingInbox && "animate-spin")} />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingInbox ? (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading inbox...
                </div>
              ) : threads.length === 0 ? (
                <p className="text-sm text-slate-500">No replies yet.</p>
              ) : (
                <div className="space-y-2">
                  {threads.map((thread) => (
                    <button key={thread.phoneNumber} type="button" className={cn("w-full rounded-md border bg-white p-3 text-left transition-colors hover:bg-slate-50", selectedThread?.phoneNumber === thread.phoneNumber && "border-indigo-300 bg-indigo-50")} onClick={() => setSelectedThreadPhone(thread.phoneNumber)}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-semibold">{thread.employeeName ?? thread.phoneNumber}</p>
                        <Badge variant={thread.latestDirection === "inbound" ? "default" : "outline"}>{thread.latestDirection}</Badge>
                      </div>
                      <p className="mt-1 truncate text-xs text-slate-500">{thread.latestMessage}</p>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-white/40 bg-white/70 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">{selectedThread?.employeeName ?? selectedThread?.phoneNumber ?? "Conversation"}</CardTitle>
              <CardDescription>{selectedThread ? selectedThread.phoneNumber : "Select a thread to view messages."}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedThread ? (
                <p className="text-sm text-slate-500">No conversation selected.</p>
              ) : (
                <>
                  <div className="max-h-[520px] space-y-3 overflow-auto rounded-md border bg-slate-50 p-3">
                    {selectedThread.messages.map((item) => (
                      <div key={`${item.direction}-${item.id}`} className={cn("flex", item.direction === "outbound" ? "justify-end" : "justify-start")}>
                        <div className={cn("max-w-[82%] rounded-lg border p-3 text-sm shadow-sm", item.direction === "outbound" ? "bg-indigo-600 text-white" : "bg-white text-slate-900")}>
                          <p className="whitespace-pre-wrap">{item.message}</p>
                          <p className={cn("mt-2 text-[11px]", item.direction === "outbound" ? "text-indigo-100" : "text-slate-500")}>
                            {formatDateTime(item.createdAt)} - {item.status}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="sms-reply">Reply with Twilio</Label>
                      <span className={cn("text-xs font-medium", replyLength > MAX_SMS_LENGTH ? "text-red-600" : "text-slate-500")}>
                        {replyLength}/{MAX_SMS_LENGTH} - {replySegmentCount || 0} segment{replySegmentCount === 1 ? "" : "s"}
                      </span>
                    </div>
                    <Textarea id="sms-reply" rows={4} value={replyMessage} onChange={(event) => setReplyMessage(event.target.value)} placeholder="Type a reply..." />
                    <Button type="button" disabled={!canReply} onClick={sendReply}>
                      {sendingReply ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                      Send reply
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </TabsContent>
    </Tabs>
  );
}

function RecentLogsCard({
  logs,
  loadingLogs,
  onRefresh,
}: {
  logs: SmsLogRow[];
  loadingLogs: boolean;
  onRefresh: () => void;
}) {
  return (
    <Card className="border-white/40 bg-white/70 shadow-sm">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Recent logs</CardTitle>
            <CardDescription>Latest SMS attempts in this department.</CardDescription>
          </div>
          <Button type="button" variant="outline" size="icon" onClick={onRefresh} disabled={loadingLogs}>
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
                <TableHead>Provider</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sent at</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="max-w-[240px]">
                    <div className="truncate font-medium">{log.employeeName ?? log.phoneNumber}</div>
                    <div className="truncate text-xs text-slate-500">{log.errorMessage ?? log.message}</div>
                  </TableCell>
                  <TableCell className="uppercase text-xs">{log.provider}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(log.status)}>{log.status}</Badge>
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
  );
}
