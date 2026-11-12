"use client";

import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { type AdminJob, triggerRunUrl } from "@/lib/job-failures";

// "O que deu errado" (E39): the failed jobs of a site, newest first, for the team only. Each one
// says the step in plain words, when and how many attempts, the known cause and what to do, and
// keeps the masked technical text folded away with a copy button. Hidden when nothing failed.

/** At most this many failures, newest first. */
const SHOWN = 5;

const dateTime = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "medium",
        timeZone: "America/Sao_Paulo",
      })
    : null;

export function JobFailures({ jobs }: { jobs: AdminJob[] }) {
  const failed = jobs.filter((job) => job.status === "failed").slice(0, SHOWN);
  if (failed.length === 0) return null;
  return (
    <section
      aria-labelledby="o-que-deu-errado"
      className="grid gap-4 rounded-xl border border-destructive/40 bg-card p-5"
    >
      <h2 id="o-que-deu-errado" className="font-display text-[1.5rem]">
        O que deu errado
      </h2>
      <ol className="grid gap-4">
        {failed.map((job, index) => (
          <Failure key={job.id} job={job} newest={index === 0} />
        ))}
      </ol>
    </section>
  );
}

function Failure({ job, newest }: { job: AdminJob; newest: boolean }) {
  const times = [
    ["Pedido", job.createdAt],
    ["Começou", job.startedAt],
    ["Terminou", job.finishedAt],
  ].filter((item): item is [string, string] => Boolean(item[1]));
  return (
    <li className="grid gap-3 rounded-lg border border-border p-4">
      <div className="grid gap-1">
        <p className="text-[1.0625rem] font-semibold">
          {job.step}
          {newest ? " · a falha mais recente" : ""}
          {job.retry ? " · era uma nova tentativa" : ""}
        </p>
        <p className="text-sm text-ink-soft">
          {times.map(([label, at]) => `${label} ${dateTime(at)}`).join(" · ")}
          {` · ${job.attempts} ${job.attempts === 1 ? "tentativa" : "tentativas"}`}
        </p>
      </div>

      {job.cause ? (
        <div className="grid gap-1 text-[0.9375rem]">
          <p>{job.cause.summary}</p>
          <p>
            <span className="font-semibold">O que fazer: </span>
            {job.cause.action}
          </p>
        </div>
      ) : (
        <p className="text-[0.9375rem]">
          <span className="font-semibold">Erro não reconhecido.</span>{" "}
          {job.error
            ? "Leia o texto abaixo e, se precisar, abra a execução no Trigger.dev."
            : "A tarefa não deixou mensagem; abra a execução no Trigger.dev."}
        </p>
      )}

      {job.error && (
        // Open at once when there is no known cause: the raw text is all there is.
        <details open={!job.cause} className="group grid gap-2">
          <summary className="touch-target cursor-pointer justify-self-start rounded text-sm font-semibold text-leaf-deep underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf">
            Detalhes técnicos
          </summary>
          <div className="mt-2 grid gap-2">
            <pre
              // biome-ignore lint/a11y/noNoninteractiveTabindex: long text scrolls; the keyboard needs to reach it
              tabIndex={0}
              className="max-h-80 overflow-auto rounded-lg bg-table p-3 font-mono text-[0.8125rem] leading-relaxed break-words whitespace-pre-wrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf"
            >
              {job.error}
            </pre>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              <CopyButton
                text={[
                  `${job.step} (${job.kind}) · ${job.finishedAt ?? job.createdAt}`,
                  job.triggerRunId ? `Run: ${job.triggerRunId}` : null,
                  `Job: ${job.id}`,
                  "",
                  job.error,
                ]
                  .filter((line) => line !== null)
                  .join("\n")}
              />
              <span className="text-ink-soft">
                Registrado em {dateTime(job.finishedAt ?? job.createdAt)} (Brasília)
              </span>
            </div>
          </div>
        </details>
      )}

      {job.triggerRunId ? (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <a
            href={triggerRunUrl(job.triggerRunId)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 font-semibold text-leaf-deep underline underline-offset-4"
          >
            Abrir a execução no Trigger.dev
            <ExternalLink aria-hidden="true" className="size-4" />
            <span className="sr-only">(abre em outra aba)</span>
          </a>
          <code className="font-mono text-[0.8125rem] text-ink-soft">{job.triggerRunId}</code>
        </p>
      ) : (
        <p className="text-sm text-ink-soft">
          Sem o id da execução (tarefas de antes do E39): procure em Trigger.dev &gt; Runs pelo
          horário.
        </p>
      )}
    </li>
  );
}

function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  return (
    <>
      <button
        type="button"
        className="touch-target inline-flex items-center rounded font-semibold text-leaf-deep underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf"
        onClick={() =>
          navigator.clipboard.writeText(text).then(
            () => setState("copied"),
            () => setState("failed"),
          )
        }
      >
        Copiar os detalhes
      </button>
      <span aria-live="polite" className="text-ink-soft">
        {state === "copied" ? "Copiado." : state === "failed" ? "Não deu para copiar." : ""}
      </span>
    </>
  );
}
