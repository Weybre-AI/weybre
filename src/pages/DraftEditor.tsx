import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, FileDown, Loader2, Sparkles, ShieldAlert, ArrowUp, Upload, Paperclip, FileText, X } from "lucide-react";
import { TEMPLATES } from "@/lib/constants";
import { AiDisclaimer } from "@/components/AiDisclaimer";
import { toast } from "sonner";
import { extractTextFromFile } from "@/lib/extractText";

interface Risk { clause: string; severity: "low" | "medium" | "high"; note: string; }
interface Attachment { id: string; file_name: string; storage_path: string; mime_type: string; file_size: number; status: string; error_message?: string | null; }

const MAX_UPLOAD_SIZE = 20 * 1024 * 1024;
const ALLOWED_UPLOAD_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "application/rtf",
  "image/png",
  "image/jpeg",
  "image/webp",
];

const formatFileSize = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

interface Draft {
  id: string;
  title: string;
  template: string;
  content: string;
  risk_flags: Risk[];
  conversation: { role: "user" | "assistant"; content: string }[];
  inputs: {
    case_context?: {
      brief?: string;
      cnr?: string;
      query?: string;
    };
    intake_used?: boolean;
    last_prompt?: string;
  }
}

interface DraftResponse {
  reply: string;
  content: string;
  risk_flags: Risk[];
  error?: string;
}

const DraftEditor = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [chat, setChat] = useState<{role: "user" | "assistant"; content: string}[]>([]);
  const [input, setInput] = useState("");
  const [risks, setRisks] = useState<Risk[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!user || !id) return;
    (async () => {
      const { data } = await supabase.from("drafts").select("*").eq("id", id).maybeSingle();
      setDraft(data as Draft | null);
      setRisks((data?.risk_flags as Risk[] ?? []));
      setChat((data?.conversation as any[] ?? []));

      // If created from a Litigation Intel result, pre-seed the chat with a draft prompt
      const ctx = data?.inputs?.case_context;
      if (ctx && !data?.inputs?.intake_used) {
        const briefPreview = String(ctx.brief ?? "").slice(0, 1800);
        const ref = ctx.cnr ? `CNR ${ctx.cnr}` : (ctx.query ?? "case");
        setInput(
          `Draft a ${TEMPLATES.find(t => t.key === data.template)?.label ?? data.template} based on this case context.\n\n` +
          `Reference: ${ref}\n\n` +
          `Case brief:\n${briefPreview}\n\n` +
          `Use the cited precedents below where relevant. Tailor to Indian court formatting and include a prayer/relief section.`
        );
        // mark consumed so we don't re-seed on every load
        await supabase.from("drafts")
          .update({ inputs: { ...(data.inputs ?? {}), intake_used: true } })
          .eq("id", id!);
      }

      const { data: files } = await supabase
        .from("draft_attachments")
        .select("id,file_name,storage_path,mime_type,file_size,status,error_message")
        .eq("draft_id", id)
        .order("created_at", { ascending: false });
      setAttachments((files ?? []) as Attachment[]);
      setLoading(false);
    })();
  }, [id, user]);

  const updateContent = (content: string) => {
    setDraft((d) => (d ? { ...d, content } : null));
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      supabase.from("drafts").update({ content }).eq("id", id!).then(() => {});
    }, 800);
  };

  const generate = async () => {
    if (!input.trim() || !draft) return;
    const userMsg = input.trim();
    const newChat = [...chat, { role: "user" as const, content: userMsg }];
    
    setInput("");
    setChat(newChat);
    setGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke<DraftResponse>("draft", {
        body: {
          draft_id: id,
          template: draft.template,
          title: draft.title,
          conversation: newChat,
          existing_content: draft.content,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const reply = data.reply ?? "";
      const newContent = data.content ?? draft.content;
      const newRisks: Risk[] = data.risk_flags ?? [];
      const updatedChat = [...newChat, { role: "assistant" as const, content: reply }];

      setChat(updatedChat);
      setDraft((d) => (d ? { ...d, content: newContent } : null));
      setRisks(newRisks);

      await supabase.from("drafts").update({
        content: newContent,
        risk_flags: newRisks,
        conversation: updatedChat,
        inputs: { ...(draft.inputs ?? {}), last_prompt: userMsg },
      }).eq("id", id!);
    } catch (err) {
      toast.error("Drafting failed", { description: (err as Error)?.message });
    } finally {
      setGenerating(false);
    }
  };

  const uploadAttachment = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !user || !id) return;
    if (file.size > MAX_UPLOAD_SIZE) {
      toast.error("Upload failed", { description: "File must be 20 MB or smaller." });
      return;
    }
    if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) {
      toast.error("Unsupported file", { description: "Upload PDF, DOC, DOCX, TXT, Markdown, or RTF files." });
      return;
    }

    setUploading(true);
    try {
      const extractedText = await extractTextFromFile(file, {
        ocrFallback: true,
        onProgress: (msg) => toast.info(msg),
      });
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `${user.id}/${id}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("draft-documents").upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });
      if (uploadError) throw uploadError;

      const { data, error } = await supabase.from("draft_attachments").insert({
        draft_id: id,
        user_id: user.id,
        file_name: file.name,
        storage_path: storagePath,
        mime_type: file.type,
        file_size: file.size,
        extracted_text: extractedText,
        status: extractedText ? "processed" : "uploaded",
      }).select("id,file_name,storage_path,mime_type,file_size,status,error_message").single();
      if (error) throw error;

      setAttachments(prev => [data as Attachment, ...prev]);
      toast.success("Document uploaded", { description: "Weybre AI will use it in the next draft or review request." });
    } catch (err) {
      toast.error("Upload failed", { description: (err as Error)?.message });
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = async (attachment: Attachment) => {
    try {
      await supabase.storage.from("draft-documents").remove([attachment.storage_path]);
      const { error } = await supabase.from("draft_attachments").delete().eq("id", attachment.id);
      if (error) throw error;
      setAttachments(prev => prev.filter(item => item.id !== attachment.id));
    } catch (err) {
      toast.error("Remove failed", { description: (err as Error)?.message });
    }
  };

  const exportDraft = async (format: "pdf" | "docx") => {
    if (!id) return;
    setExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("export-draft", {
        body: { draft_id: id, format },
      });
      if (error) throw error;
      const mime = format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      const blob = new Blob([Uint8Array.from(atob(data.file), c => c.charCodeAt(0))], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `${draft.title}.${format}`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error("Export failed", { description: (err as Error)?.message });
    } finally { setExporting(false); }
  };



  if (loading) return <AppShell><div className="flex h-screen items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div></AppShell>;
  if (!draft) return <AppShell><div className="container py-10">Draft not found.</div></AppShell>;

  const tpl = TEMPLATES.find(t => t.key === draft.template);

  return (
    <AppShell>
      <div className="grid min-h-[calc(100dvh-3.5rem)] grid-cols-1 lg:min-h-[calc(100dvh-4rem)] lg:grid-cols-[1fr_min(400px,40vw)]">
        {/* Document */}
        <div className="overflow-y-auto border-r border-border">
          <div className="container max-w-3xl py-6">
            <Link to="/app/drafts" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> All drafts</Link>
            <div className="mt-4 flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs uppercase tracking-wider text-accent">{tpl?.label ?? draft.template}</p>
                <h1 className="mt-1 font-serif text-2xl font-semibold tracking-tight text-primary">{draft.title}</h1>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => exportDraft("docx")} disabled={exporting}><FileDown className="h-4 w-4" />DOCX</Button>
                <Button size="sm" variant="outline" onClick={() => exportDraft("pdf")} disabled={exporting}><FileDown className="h-4 w-4" />PDF</Button>

              </div>
            </div>

            <div className="mt-4"><AiDisclaimer /></div>

            <div className="mt-5 border border-border bg-card p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 font-serif text-base font-semibold text-primary"><Paperclip className="h-4 w-4 text-accent" /> Source documents</div>
                  <p className="mt-1 text-sm text-muted-foreground">Upload contracts, notices, PDFs, or notes for AI drafting, review, redlines, and issue spotting.</p>
                </div>
                <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.txt,.md,.rtf,.png,.jpg,.jpeg,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,application/rtf,image/png,image/jpeg,image/webp" onChange={uploadAttachment} />
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload
                </Button>
              </div>
              {attachments.length > 0 && (
                <div className="mt-4 space-y-2">
                  {attachments.map(file => (
                    <div key={file.id} className="flex items-center justify-between gap-3 border border-border bg-background px-3 py-2 text-sm">
                      <div className="flex min-w-0 items-center gap-2">
                        <FileText className="h-4 w-4 shrink-0 text-accent" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{file.file_name}</p>
                          <p className="text-xs text-muted-foreground">{formatFileSize(file.file_size)} · {file.status === "processed" ? "ready for AI" : file.status}</p>
                        </div>
                      </div>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeAttachment(file)} aria-label={`Remove ${file.file_name}`}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Textarea
              value={draft.content ?? ""}
              onChange={e => updateContent(e.target.value)}
              placeholder="Use the chat on the right to generate clauses, or type your draft here."
              className="mt-5 min-h-[40vh] font-serif text-[1.02rem] leading-[1.8] sm:min-h-[600px]"
            />

            {risks.length > 0 && (
              <div className="mt-6">
                <h3 className="mb-3 flex items-center gap-2 font-serif text-base font-semibold text-primary"><ShieldAlert className="h-4 w-4 text-warning" /> Risk flags</h3>
                <div className="space-y-2">
                  {risks.map((r, i) => (
                    <div key={i} className="rounded-lg border border-border bg-card p-3">
                      <div className="flex items-center gap-2 text-xs">
                        <span className={`rounded-full px-2 py-0.5 font-medium ${r.severity === "high" ? "bg-destructive/15 text-destructive" : r.severity === "medium" ? "bg-warning/15 text-warning" : "bg-success/15 text-success"}`}>{r.severity}</span>
                        <span className="font-mono text-[0.7rem] text-muted-foreground">{r.clause}</span>
                      </div>
                      <p className="mt-1.5 text-sm text-foreground">{r.note}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Chat */}
        <div className="flex flex-col bg-card/40">
          <div className="border-b border-border px-5 py-4">
            <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-accent" /><span className="font-serif font-semibold text-primary">Drafting assistant</span></div>
            <p className="mt-1 text-xs text-muted-foreground">Tell me about the parties, jurisdiction, and key terms.</p>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {chat.length === 0 && (
              <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                Try: <em>"Review the uploaded agreement, list legal risks, then suggest safer replacement clauses."</em>
              </div>
            )}
            {chat.map((m, i) => (
              <div key={i} className={`rounded-lg p-3 text-sm leading-relaxed ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border border-border text-foreground"}`}>
                {m.content}
              </div>
            ))}
            {generating && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin text-accent" /> Drafting…</div>}
          </div>

          <div className="border-t border-border bg-background p-4">
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask AI to draft, review uploaded docs, spot issues, or suggest clause changes…"
              className="min-h-[80px] resize-none"
              onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate(); }}
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">⌘ + Enter</span>
              <Button onClick={generate} disabled={generating || !input.trim()} size="sm" className="bg-primary hover:bg-primary-glow">{generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}Generate</Button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
};

export default DraftEditor;
