'use client';

import { useState } from 'react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const outputs = [
  ['LINKEDIN', 'Professional post'], ['X / THREAD', 'Short-form social'], ['ADVISORY', 'Action-oriented brief'],
  ['EXECUTIVE SUMMARY', 'Decision brief'], ['PRESENTATION', 'Slides + speaker notes'], ['VIDEO', 'Script + storyboard'],
  ['INFOGRAPHIC', 'Visual content brief'],
];


function formatPassportDate(value: any): string {
  if (!value) return 'N/A';

  try {
    return new Date(value).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return String(value);
  }
}

function displayClaim(x: any): string {
  if (typeof x === 'string') return x;

  if (x && typeof x === 'object') {
    if (x.text) return String(x.text);
    if (x.claim) return String(x.claim);
    if (x.description) return String(x.description);
    if (x.label) return String(x.label);
    if (x.claim_id) return String(x.claim_id);
  }

  return String(x ?? '');
}

function displayConflict(x: any): string {
  if (typeof x === 'string') return x;

  if (x && typeof x === 'object') {
    if (Array.isArray(x)) {
      return x.map((item) => displayConflict(item)).filter(Boolean).join(' · ');
    }

    const text =
      x.text ||
      x.claim ||
      x.description ||
      x.label ||
      x.statement ||
      x.message ||
      x.value ||
      '';

    const source = x.source || x.source_name || x.source_type || '';

    if (text && source) return `${String(text)} — ${String(source)}`;
    if (text) return String(text);

    // Handle nested conflict structures safely
    const nested =
      x.conflict ||
      x.conflicting_claim ||
      x.details ||
      x.data;

    if (nested) return displayConflict(nested);

    // Last-resort readable JSON instead of [object Object]
    try {
      return JSON.stringify(x);
    } catch {
      return 'Conflict detected';
    }
  }

  return String(x ?? '');
}

export default function Engine() {
  const [files, setFiles] = useState<File[]>([]);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [output, setOutput] = useState<any>(null);
  const [generatedOutputs, setGeneratedOutputs] = useState<any[]>([]);
  const [mode, setMode] = useState('AUTO');
  const [audience, setAudience] = useState('Adaptive');
  const [language, setLanguage] = useState('English');
  const [tone, setTone] = useState('Professional');
  const [objective, setObjective] = useState('Inform');
  const [detail, setDetail] = useState('Medium');
  const [selectedOutputs, setSelectedOutputs] = useState<string[]>(['LINKEDIN']);
  const [fileInputKey, setFileInputKey] = useState(0);

  async function run() {
    if (!files.length && !url.trim()) { setData({ error: 'Upload a source or paste a URL first.' }); return; }
    setLoading(true);
    setData(null);
    setOutput(null);
    try {
      const fd = new FormData();
      files.forEach(f => fd.append('files', f));
      if (url.trim()) fd.append('url', url.trim());
      fd.append('mode', mode);
      const r = await fetch(`${API}/api/v1/analyze`, { method: 'POST', body: fd });
      const json = await r.json();
      if (!r.ok) throw new Error(json.detail || 'Analysis failed');
      setData(json);
    } catch (e: any) { setData({ error: e.message || 'Backend unavailable.' }); }
    finally { setLoading(false); }
  }

  function resetAnalysis() {
    setFiles([]);
    setUrl('');
    setData(null);
    setOutput(null);
    setGeneratedOutputs([]);
    setFileInputKey(k => k + 1);
  }


  function toggleOutput(name: string) {
    setSelectedOutputs(prev =>
      prev.includes(name)
        ? prev.filter(x => x !== name)
        : [...prev, name]
    );
  }

  function selectAllOutputs() {
    setSelectedOutputs(outputs.map(([name]) => name));
  }

  function clearOutputSelection() {
    setSelectedOutputs([]);
  }

  function prettyLabel(key: string): string {
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  function readableValue(value: any): any {
    if (value === null || value === undefined) return null;

    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    if (Array.isArray(value)) {
      return (
        <ul className="readableList">
          {value.map((item: any, i: number) => (
            <li key={i}>
              {typeof item === 'object'
                ? readableObject(item)
                : String(item)}
            </li>
          ))}
        </ul>
      );
    }

    if (typeof value === 'object') {
      return readableObject(value);
    }

    return String(value);
  }

  function readableObject(obj: any): any {
    return (
      <div className="readableObject">
        {Object.entries(obj).map(([key, value]: [string, any]) => (
          <div className="readableRow" key={key}>
            <div className="readableKey">{prettyLabel(key)}</div>
            <div className="readableValue">
              {readableValue(value)}
            </div>
          </div>
        ))}
      </div>
    );
  }

  function readableText(text: string) {
    return (
      <div className="readableText">
        {text
          .split(/\n{2,}/)
          .filter(Boolean)
          .map((part: string, i: number) => (
            <p key={i}>{part.trim()}</p>
          ))}
      </div>
    );
  }

  function cleanDisplayText(value: any): string {
    if (value === null || value === undefined) return '';

    if (typeof value === 'string') {
      return value
        // Internal claim references
        .replace(/\[?C\d+\]?/gi, '')
        .replace(/\bClaim\s*\d+\b/gi, '')
        .replace(/\bClaims?\s*\d+(?:\s*&\s*\d+)?\b/gi, '')

        // Confidence / internal metadata
        .replace(/\s*\(?\s*confidence\s*[:=]?\s*[\d.]+\s*\)?/gi, '')
        .replace(/\s*\(?\s*status\s*[:=]\s*(unknown|known|conflicting|unresolved)\s*\)?/gi, '')

        // Source labels / filenames must NOT appear in publishable output
        .replace(/\s*\[\s*source\s*\]\s*/gi, ' ')
        .replace(/\s*\(\s*source\s*:\s*[^)]+\)\s*/gi, ' ')
        .replace(/\s*source\s*:\s*[A-Za-z0-9_.\-\/]+\s*/gi, ' ')

        // Markdown formatting
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/__(.*?)__/g, '$1')
        .replace(/`([^`]*)`/g, '$1')
        .replace(/^\s*#{1,6}\s+/gm, '')

        // Common model labels that should never leak into the final post
        .replace(/^\s*(structured\s*output|json|content|hook|linkedin\s*post)\s*:\s*/gim, '')

        // Remove empty metadata brackets left after cleaning
        .replace(/\(\s*\)/g, '')
        .replace(/\[\s*\]/g, '')

        // Remove generic source-document labels
        .replace(/\(\s*source\s+document\.?\s*\)/gi, '')
        .replace(/\[\s*source\s+document\.?\s*\]/gi, '')

        // Cleanup
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/\n[ \t]+/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]+\./g, '.')
        .replace(/[ \t]+,/g, ',')
        .trim();
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    return String(value);
  }

  function flattenOutput(value: any): string {
    if (value === null || value === undefined) return '';

    if (typeof value === 'string') {
      return cleanDisplayText(value);
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    if (Array.isArray(value)) {
      return value
        .map((item) => flattenOutput(item))
        .filter(Boolean)
        .join('\n');
    }

    if (typeof value === 'object') {
      return Object.entries(value)
        .filter(([key]) =>
          ![
            'used_claims',
            'warnings',
            'affected_claims',
            'claim_ids',
            'passport',
            'model'
          ].includes(key)
        )
        .map(([key, value]) => {
          const text = flattenOutput(value);
          return text ? `${prettyLabel(key)}\n${text}` : '';
        })
        .filter(Boolean)
        .join('\n\n');
    }

    return '';
  }

  function getStructured(item: any): any {
    if (
      item?.structured_output &&
      typeof item.structured_output === 'object'
    ) {
      return item.structured_output;
    }

    if (
      item?.content &&
      typeof item.content === 'object' &&
      !Array.isArray(item.content)
    ) {
      return item.content;
    }

    return null;
  }

  function getPlatformText(item: any): string {
    const type = String(item?.output_type || '').toUpperCase();

    function extract(value: any): string {
      if (value === null || value === undefined) return '';

      if (typeof value === 'string') {
        return cleanDisplayText(value);
      }

      if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
      }

      if (Array.isArray(value)) {
        return value
          .map((entry) => extract(entry))
          .filter(Boolean)
          .join('\n\n');
      }

      if (typeof value !== 'object') return '';

      // Never expose internal model metadata.
      const blocked = new Set([
        'structured_output',
        'used_claims',
        'warnings',
        'affected_claims',
        'claim_ids',
        'passport',
        'model',
        'controls',
        'status',
        'output_type',
        'id',
        'generated_at',
        'human_review_required',
        'ai_generated'
      ]);

      // Prefer actual human-facing fields.
      const preferredKeys = [
        'content',
        'text',
        'body',
        'post',
        'message',
        'narration',
        'subtitles',
        'description',
        'summary',
        'takeaway'
      ];

      for (const key of preferredKeys) {
        if (
          Object.prototype.hasOwnProperty.call(value, key) &&
          !blocked.has(key)
        ) {
          const result = extract(value[key]);
          if (result) return result;
        }
      }

      // LinkedIn / Executive / Advisory structured sections.
      if (Array.isArray(value.sections)) {
        return value.sections
          .map((section: any) => {
            if (typeof section === 'string') return cleanDisplayText(section);

            if (section && typeof section === 'object') {
              const sectionText =
                section.body ||
                section.text ||
                section.content ||
                section.description ||
                section.value;

              if (typeof sectionText === 'string') {
                return cleanDisplayText(sectionText);
              }

              return extract(sectionText);
            }

            return '';
          })
          .filter(Boolean)
          .join('\n\n');
      }

      // X / Twitter thread.
      if (
        type === 'X / THREAD' ||
        type === 'X' ||
        type === 'THREAD'
      ) {
        const posts =
          value.posts ||
          value.thread ||
          value.tweets;

        if (Array.isArray(posts)) {
          return posts
            .map((post: any) => {
              if (typeof post === 'string') {
                return cleanDisplayText(post);
              }

              if (post && typeof post === 'object') {
                return cleanDisplayText(
                  post.text ||
                  post.content ||
                  post.body ||
                  ''
                );
              }

              return '';
            })
            .filter(Boolean)
            .join('\n\n');
        }
      }

      // Generic nested content, but NEVER print object keys.
      return Object.entries(value)
        .filter(([key]) => !blocked.has(key))
        .map(([, child]) => extract(child))
        .filter(Boolean)
        .join('\n\n');
    }

    // Most reliable case: backend returned plain publishable content.
    if (typeof item?.content === 'string') {
      return cleanDisplayText(item.content);
    }

    // Some responses wrap the actual result inside content.
    if (
      item?.content &&
      typeof item.content === 'object' &&
      !Array.isArray(item.content)
    ) {
      const content = extract(item.content);
      if (content) return content;
    }

    // Otherwise inspect structured_output without exposing its keys.
    if (
      item?.structured_output &&
      typeof item.structured_output === 'object'
    ) {
      const structured = extract(item.structured_output);
      if (structured) return structured;
    }

    if (Array.isArray(item?.content)) {
      return extract(item.content);
    }

    return '';
  }


  function cleanPublishText(value: any): string {
    if (value == null) return "";

    let text = "";

    if (typeof value === "string") {
      text = value;
    } else if (typeof value === "number" || typeof value === "boolean") {
      text = String(value);
    } else if (Array.isArray(value)) {
      text = value.map((x) => cleanPublishText(x)).filter(Boolean).join("\n");
    } else if (typeof value === "object") {
      const preferred = [
        "content",
        "text",
        "body",
        "description",
        "summary",
        "value",
        "fact",
        "details",
      ];

      for (const key of preferred) {
        if (value[key] != null) {
          const candidate = cleanPublishText(value[key]);
          if (candidate) {
            text = candidate;
            break;
          }
        }
      }

      if (!text) {
        text = Object.values(value)
          .map((x) => cleanPublishText(x))
          .filter(Boolean)
          .join(" ");
      }
    }

    return text
      // internal claim/source refs
      .replace(/\[[\s]*C\d+[\s]*\]/gi, "")
      .replace(/\([\s]*C\d+[\s]*\)/gi, "")
      .replace(/\bC\d+\b/gi, "")
      .replace(/\[[\s]*X\d+[\s]*\]/gi, "")
      .replace(/\([\s]*X\d+[\s]*\)/gi, "")
      .replace(/\bX\d+\b/gi, "")
      .replace(/\[[\s]*U\d+[\s]*\]/gi, "")
      .replace(/\([\s]*U\d+[\s]*\)/gi, "")
      .replace(/\bU\d+\b/gi, "")
      // empty leftovers created after reference removal
      .replace(/\(\s*\)/g, "")
      .replace(/\[\s*\]/g, "")
      .replace(/\{\s*\}/g, "")
      // X thread numbering should be rendered by UI, not model text
      .replace(/^\s*\d+\s*\/\s*\d+\s*/g, "")
      // metadata labels
      .replace(/\bsource\s*:\s*[^.\n]+/gi, "")
      .replace(/\bconfidence\s*[:=]?\s*\d+(?:\.\d+)?\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .replace(/\s+([,.;:!?])/g, "$1")
      .trim();
  }

  function outputHeader(
    icon: string,
    title: string,
    subtitle: string
  ) {
    return (
      <div className="platformOutputHeader">
        <div className="platformBrand">{icon}</div>
        <div className="platformHeaderText">
          <strong>{title}</strong>
          <span>{subtitle}</span>
        </div>
      </div>
    );
  }

  function sectionText(section: any): string {
    if (!section) return '';

    if (typeof section === 'string') {
      return cleanPublishText(section);
    }

    if (Array.isArray(section)) {
      return section
        .map((x) => sectionText(x))
        .filter(Boolean)
        .join('\n\n');
    }

    if (typeof section === 'object') {
      const preferred = [
        'body',
        'text',
        'content',
        'description',
        'value',
        'summary',
        'narration',
        'speaker_notes'
      ];

      for (const key of preferred) {
        if (typeof section[key] === 'string' && section[key].trim()) {
          return cleanPublishText(section[key]);
        }
      }

      if (Array.isArray(section.bullets)) {
        return section.bullets
          .map((x: any) => cleanPublishText(x))
          .filter(Boolean)
          .join('\n');
      }

      if (Array.isArray(section.data_points)) {
        return section.data_points
          .map((x: any) => cleanPublishText(x))
          .filter(Boolean)
          .join('\n');
      }
    }

    return '';
  }


  function renderBulletText(text: string) {
    return cleanPublishText(text)
      .split(/\n+/)
      .map((x) => x.replace(/^[•\-]\s*/, '').trim())
      .filter(Boolean);
  }

  function getCleanStructured(item: any): any {
    if (
      item?.structured_output &&
      typeof item.structured_output === 'object'
    ) {
      return item.structured_output;
    }

    if (
      item?.content &&
      typeof item.content === 'object'
    ) {
      return item.content;
    }

    return null;
  }

  function getCleanPlatformText(item: any): string {
    if (typeof item?.content === 'string') {
      return cleanPublishText(item.content);
    }

    const structured = getCleanStructured(item);

    if (!structured) return '';

    if (typeof structured.content === 'string') {
      return cleanPublishText(structured.content);
    }

    if (typeof structured.text === 'string') {
      return cleanPublishText(structured.text);
    }

    if (typeof structured.body === 'string') {
      return cleanPublishText(structured.body);
    }

    if (Array.isArray(structured.sections)) {
      return structured.sections
        .map((section: any) => sectionText(section))
        .filter(Boolean)
        .join('\n\n');
    }

    return '';
  }

  function renderParagraphs(text: string) {
    return text
      .split(/\\n{2,}/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part, i) => (
        <p key={i}>{part}</p>
      ));
  }

  
  function cleanInfographicValue(value: any): string {
    if (value == null) return "";

    if (typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean") {
      return cleanPublishText(value);
    }

    if (Array.isArray(value)) {
      return value
        .map((x) => cleanInfographicValue(x))
        .filter(Boolean)
        .join(" • ");
    }

    if (typeof value === "object") {
      const preferred = [
        "value",
        "metric",
        "number",
        "text",
        "content",
        "description",
        "details",
        "summary",
        "points",
      ];

      for (const key of preferred) {
        if (value[key] != null) {
          const v = cleanInfographicValue(value[key]);
          if (v) return v;
        }
      }

      return Object.entries(value)
        .filter(([key]) =>
          ![
            "visual",
            "visual_type",
            "visualType",
            "layout",
            "icon",
            "icon_name",
            "chart_type",
            "display_type",
          ].includes(key)
        )
        .map(([key, val]) => {
          const v = cleanInfographicValue(val);
          return v ? `${key.replace(/_/g, " ")}: ${v}` : "";
        })
        .filter(Boolean)
        .join(" • ");
    }

    return "";
  }

function renderGeneratedContent(item: any) {
    const rawType = String(item?.output_type || item?.type || "").toUpperCase();
    const type = rawType.replace(/\s+/g, " ").trim();

    // Strict output classification.
    // Never use broad includes("X") because it can misclassify
    // unrelated output types/fallback values.
    const isXThread =
      type === "X" ||
      type === "X THREAD" ||
      type === "X / THREAD" ||
      type === "THREAD" ||
      type === "TWITTER" ||
      type === "TWITTER THREAD";

    const isPresentation =
      type === "PRESENTATION" ||
      type === "SLIDES" ||
      type === "PRESENTATION / SLIDES" ||
      type.includes("PRESENTATION") ||
      type.includes("SLIDE");

    const isExecutive =
      type === "EXECUTIVE SUMMARY" ||
      type === "EXECUTIVE";

    const isAdvisory =
      type === "ADVISORY";

    const isLinkedIn =
      type === "LINKEDIN" ||
      type === "LINKEDIN POST";

    const isVideo =
      type === "VIDEO" ||
      type === "VIDEO SCRIPT";

    const isInfographic =
      type === "INFOGRAPHIC";

    function parseMaybeJSON(value: any): any {
      if (value == null) return null;
      if (typeof value !== "string") return value;

      const trimmed = value.trim();
      if (!trimmed) return "";

      try {
        return JSON.parse(trimmed);
      } catch {
        return value;
      }
    }

    function clean(value: any): string {
      if (value == null) return "";

      if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
      }

      if (Array.isArray(value)) {
        return value
          .map((v) => clean(v))
          .filter(Boolean)
          .join("\n");
      }

      if (typeof value === "object") {
        const preferred = [
          "text",
          "content",
          "body",
          "description",
          "summary",
          "value",
          "narration",
          "speaker_notes",
          "visual",
          "visual_direction",
          "subtitles",
        ];

        for (const key of preferred) {
          if (value[key] != null) {
            const result = clean(value[key]);
            if (result) return result;
          }
        }

        return Object.entries(value)
          .filter(([key]) =>
            ![
              "claim_id",
              "claim_ids",
              "used_claims",
              "affected_claims",
              "confidence",
              "source",
              "sources",
              "metadata",
              "id",
            ].includes(key)
          )
          .map(([key, val]) => `${key}: ${clean(val)}`)
          .filter(Boolean)
          .join("\n");
      }

      return String(value)
        // internal claim references
        .replace(/\bC\d+\b/gi, "")
        .replace(/[\(\[]\s*C\d+\s*[\)\]]/gi, "")
        .replace(/\bClaim\s*ID\s*:?\s*C\d+\b/gi, "")
        // confidence/source metadata
        .replace(/\[(?:\s*)confidence[^]]*\]/gi, "")
        .replace(/\((?:\s*)confidence[^)]*\)/gi, "")
        .replace(/\[(?:\s*)source[^]]*\]/gi, "")
        .replace(/\((?:\s*)source[^)]*\)/gi, "")
        // raw source filename leakage
        .replace(/\bsource\s*:\s*[^\n|]+?\.(?:pdf|docx?|txt|png|jpe?g)\b/gi, "")
        .replace(/\b[A-Za-z0-9_.-]+\.(?:pdf|docx?|txt|png|jpe?g)\b/gi, "")
        // generated metadata leakage
        .replace(/\b\d+\s*characters?\s*Source[- ]backed information\b/gi, "")
        .replace(/\bSource[- ]backed information\b/gi, "")
        // malformed JSON-ish punctuation
        .replace(/\(\s*[,;:]\s*/g, "(")
        .replace(/\[\s*[,;:]\s*/g, "[")
        .replace(/\{\s*[,;:]\s*/g, "{")
        .replace(/\s+([,.;:])/g, "$1")
        .replace(/([,.;:])\s*([,.;:])/g, "$1")
        .replace(/\s{2,}/g, " ")
        .trim();
    }

    function valueText(value: any): string {
      return clean(value);
    }

    function structuredRoot(itemValue: any): any {
      return parseMaybeJSON(
        itemValue?.structured_output ??
        itemValue?.structuredOutput ??
        itemValue?.data ??
        null
      );
    }

    function arrayFromKeys(root: any, keys: string[]): any[] {
      if (!root) return [];

      if (Array.isArray(root)) return root;

      if (typeof root !== "object") return [];

      for (const key of keys) {
        const value = root[key];
        if (Array.isArray(value)) return value;
      }

      return [];
    }

    function objectSections(root: any): Array<{ title: string; body: string }> {
      if (!root) return [];

      const sections = arrayFromKeys(root, [
        "sections",
        "content_sections",
        "advisory_sections",
        "summary_sections",
        "blocks",
      ]);

      if (sections.length) {
        return sections
          .map((section: any, index: number) => {
            if (typeof section === "string") {
              return {
                title: `SECTION ${String(index + 1).padStart(2, "0")}`,
                body: clean(section),
              };
            }

            const title = clean(
              section?.title ??
              section?.heading ??
              section?.section ??
              section?.name ??
              `SECTION ${String(index + 1).padStart(2, "0")}`
            );

            const body = clean(
              section?.body ??
              section?.content ??
              section?.text ??
              section?.description ??
              section?.value ??
              section?.summary ??
              section
            );

            return { title, body };
          })
          .filter((x) => x.body);
      }

      if (typeof root === "object" && !Array.isArray(root)) {
        const ignored = new Set([
          "title",
          "subtitle",
          "description",
          "summary",
          "content",
          "body",
          "warnings",
          "used_claims",
          "affected_claims",
          "sources",
          "metadata",
        ]);

        const result = Object.entries(root)
          .filter(([key, value]) => !ignored.has(key) && value != null)
          .map(([key, value]) => ({
            title: key
              .replace(/_/g, " ")
              .replace(/\b\w/g, (c) => c.toUpperCase()),
            body: clean(value),
          }))
          .filter((x) => x.body);

        if (result.length) return result;
      }

      return [];
    }

    function splitLabeledText(text: string, labels: string[]) {
      const cleaned = clean(text);
      if (!cleaned) return [];

      const escaped = labels
        .sort((a, b) => b.length - a.length)
        .map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

      const re = new RegExp(
        `(^|\\s)(${escaped.join("|")})\\s*[:\\-–—]?\\s*`,
        "gi"
      );

      const matches: Array<{ label: string; index: number; end: number }> = [];
      let match: RegExpExecArray | null;

      while ((match = re.exec(cleaned)) !== null) {
        matches.push({
          label: match[2],
          index: match.index + match[1].length,
          end: re.lastIndex,
        });
      }

      if (!matches.length) return [];

      return matches
        .map((m, index) => {
          const bodyEnd =
            index + 1 < matches.length
              ? matches[index + 1].index
              : cleaned.length;

          return {
            title: m.label,
            body: clean(cleaned.slice(m.end, bodyEnd)),
          };
        })
        .filter((x) => x.body);
    }

    function getMainText(itemValue: any): string {
      return clean(
        itemValue?.content ??
        itemValue?.text ??
        itemValue?.body ??
        itemValue?.description ??
        itemValue?.summary ??
        ""
      );
    }

    function renderSectionCards(
      sections: Array<{ title: string; body: string }>,
      className = "inforgeSections"
    ) {
      return (
        <div className={className}>
          {sections.map((section, index) => (
            <div className="inforgeSectionCard" key={`${section.title}-${index}`}>
              <div className="inforgeSectionIndex">
                {String(index + 1).padStart(2, "0")}
              </div>
              <div className="inforgeSectionContent">
                <h3>{clean(section.title)}</h3>
                <div className="inforgeSectionBody">
                  {section.body
                    .split(/\n+/)
                    .map((line) => clean(line))
                    .filter(Boolean)
                    .map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    function renderBullets(value: any) {
      const values = Array.isArray(value)
        ? value
        : String(value || "")
            .split(/\n+/)
            .map((x) => x.replace(/^[•*-]\s*/, "").trim())
            .filter(Boolean);

      return (
        <ul className="inforgeBulletList">
          {values.map((v, i) => (
            <li key={i}>{clean(v)}</li>
          ))}
        </ul>
      );
    }

    const root = structuredRoot(item);
    const mainText = getMainText(item);

    // ----------------------------------------------------------
    // X / THREAD — preserve the working card-based renderer.
    // ----------------------------------------------------------
    if (isXThread) {
      const posts = arrayFromKeys(root, [
        "posts",
        "thread",
        "tweets",
        "items",
      ]);

      let thread = posts
        .map((post: any) =>
          clean(
            typeof post === "string"
              ? post
              : post?.content ?? post?.text ?? post?.body ?? post
          )
        )
        .filter(Boolean);

      if (!thread.length) {
        thread = mainText
          .split(/\n+/)
          .map((line) => line.replace(/^\s*\d+\s*\/\s*\d+\s*/, "").trim())
          .filter(Boolean);
      }

      if (!thread.length) {
        thread = [mainText || "No thread content available."];
      }

      return (
        <div className="xOutput">
          <div className="xBrand">
            <span>𝕏</span>
            <div>
              <strong>X Thread</strong>
              <small>{thread.length} posts · Copy-ready</small>
            </div>
          </div>

          <div className="xThreadList">
            {thread.map((post, index) => (
              <div className="xPost" key={index}>
                <div className="xPostNumber">
                  {index + 1}/{thread.length}
                </div>
                <div className="xPostContent">
                  <p>{clean(post)}</p>
                  <small>• {clean(post).length} CHARS</small>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // ----------------------------------------------------------
    // PRESENTATION — keep separate slide cards.
    // ----------------------------------------------------------
    if (isPresentation) {
      const structured = getCleanStructured(item);
      const rawStructured =
        item?.structured_output ??
        item?.structured ??
        item?.data ??
        structured;

      const slides =
        Array.isArray(rawStructured?.slides) ? rawStructured.slides :
        Array.isArray(rawStructured) ? rawStructured :
        Array.isArray(structured?.slides) ? structured.slides :
        [];

      if (slides.length > 0) {
        return (
          <div className="presentationOutput">
            {slides.map((slide: any, index: number) => {
              const title = cleanPublishText(
                slide?.title ??
                slide?.heading ??
                slide?.name ??
                `Slide ${index + 1}`
              );

              const bulletsRaw =
                slide?.bullets ??
                slide?.points ??
                slide?.key_points ??
                slide?.content ??
                [];

              const bullets = Array.isArray(bulletsRaw)
                ? bulletsRaw.map((x: any) => cleanPublishText(
                    typeof x === "string"
                      ? x
                      : x?.text ?? x?.content ?? x?.point ?? x?.value ?? ""
                  )).filter(Boolean)
                : cleanPublishText(String(bulletsRaw || ""))
                    .split(/\\n|•|\\|/)
                    .map((x) => x.trim())
                    .filter(Boolean);

              const notes = cleanPublishText(
                slide?.speaker_notes ??
                slide?.speakerNotes ??
                slide?.notes ??
                slide?.speaker_note ??
                ""
              );

              return (
                <article className="presentationSlide" key={index}>
                  <div className="presentationSlideTop">
                    <span className="presentationSlideNumber">
                      SLIDE {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>

                  <h3 className="presentationSlideTitle">{title}</h3>

                  {bullets.length > 0 && (
                    <ul className="presentationBullets">
                      {bullets.map((bullet: string, bulletIndex: number) => (
                        <li key={bulletIndex}>{bullet}</li>
                      ))}
                    </ul>
                  )}

                  {notes && (
                    <div className="presentationSpeakerNotes">
                      <span>SPEAKER NOTES</span>
                      <p>{notes}</p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        );
      }

      // Fallback: preserve the existing presentation text if the model
      // returned a non-slide structure.
      return (
        <div className="presentationOutput">
          {renderParagraphs(getCleanPlatformText(item))}
        </div>
      );
    }

    if (isVideo) {
      const scenes = arrayFromKeys(root, [
        "scenes",
        "storyboard",
        "shots",
      ]);

      if (scenes.length) {
        return (
          <div className="inforgeScenes">
            {scenes.map((scene: any, index: number) => {
              const visual = clean(
                scene?.visual ??
                scene?.visual_direction ??
                scene?.visuals ??
                scene?.direction ??
                ""
              );

              const narration = clean(
                scene?.narration ??
                scene?.voiceover ??
                scene?.voice_over ??
                scene?.script ??
                scene?.content ??
                ""
              );

              const subtitles = clean(
                scene?.subtitles ??
                scene?.subtitle ??
                ""
              );

              const duration = clean(
                scene?.duration ??
                scene?.time ??
                ""
              );

              return (
                <div className="inforgeScene" key={index}>
                  <div className="inforgeSceneTop">
                    <strong>
                      SCENE {String(index + 1).padStart(2, "0")}
                    </strong>
                    {duration && <span>{duration}</span>}
                  </div>

                  {visual && (
                    <div className="inforgeSceneBlock">
                      <span>VISUAL DIRECTION</span>
                      <p>{visual}</p>
                    </div>
                  )}

                  {narration && (
                    <div className="inforgeSceneBlock">
                      <span>NARRATION</span>
                      <p>{narration}</p>
                    </div>
                  )}

                  {subtitles && (
                    <div className="inforgeSceneBlock">
                      <span>SUBTITLES</span>
                      <p>{subtitles}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      }

      // If the model returned labeled scene text rather than JSON.
      const sceneSections = splitLabeledText(
        mainText,
        ["Scene 01", "Scene 02", "Scene 03", "Scene 04", "Scene 05",
         "Scene 06", "Scene 07", "Scene 08", "Scene 09", "Scene 10"]
      );

      if (sceneSections.length) {
        return renderSectionCards(sceneSections, "inforgeScenes");
      }

      return (
        <div className="inforgeFallbackText">
          <p>{mainText}</p>
        </div>
      );
    }

    // ----------------------------------------------------------
    // INFOGRAPHIC — data/section cards.
    // ----------------------------------------------------------
    if (isInfographic) {
      const sections = arrayFromKeys(root, [
        "sections",
        "data_points",
        "dataPoints",
        "facts",
        "items",
      ]);

      function infographicValue(section: any): string {
        if (section == null) return "";

        if (typeof section === "string") {
          return clean(section);
        }

        if (Array.isArray(section)) {
          return section.map((x) => clean(x)).filter(Boolean).join(" · ");
        }

        if (typeof section !== "object") {
          return clean(section);
        }

        // Prefer actual factual/data fields.
        const preferred = [
          "value",
          "metric",
          "stat",
          "number",
          "data",
          "details",
          "description",
          "content",
          "text",
          "body",
          "summary",
          "fact",
        ];

        for (const key of preferred) {
          if (section[key] != null) {
            const value = clean(section[key]);
            if (value && !/^(icon-grid|bar-chart|calendar|timeline|dual-number|question-mark)$/i.test(value)) {
              return value;
            }
          }
        }

        // If data is nested, flatten useful factual values.
        if (section.data && typeof section.data === "object") {
          const values = Object.entries(section.data)
            .filter(([key]) =>
              ![
                "visual",
                "visual_type",
                "layout",
                "icon",
                "icon_name",
                "chart_type",
                "display_type",
              ].includes(key)
            )
            .map(([key, value]) => {
              const v = clean(value);
              return v ? `${key.replace(/_/g, " ")}: ${v}` : "";
            })
            .filter(Boolean);

          if (values.length) return values.join(" · ");
        }

        // Last useful fallback: keep factual object values and
        // deliberately ignore visual/layout metadata.
        const ignored = new Set([
          "visual",
          "visual_type",
          "layout",
          "icon",
          "icon_name",
          "chart_type",
          "display_type",
          "id",
          "type",
        ]);

        const values = Object.entries(section)
          .filter(([key, value]) => !ignored.has(key) && value != null)
          .map(([key, value]) => {
            const v = clean(value);
            return v ? `${key.replace(/_/g, " ")}: ${v}` : "";
          })
          .filter(Boolean);

        return values.join(" · ");
      }

      if (sections.length) {
        return (
          <div className="inforgeInfoGrid">
            {sections.map((section: any, index: number) => {
              const title = clean(
                section?.title ??
                section?.heading ??
                section?.label ??
                section?.name ??
                `SECTION ${String(index + 1).padStart(2, "0")}`
              );

              const value = cleanInfographicValue(section);

              return (
                <div className="inforgeInfoCard" key={index}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <h3>{title}</h3>
                  <p>{value || "Information available in the verified source context."}</p>
                </div>
              );
            })}
          </div>
        );
      }

      const sectionsFromObject = objectSections(root);

      if (sectionsFromObject.length) {
        return (
          <div className="inforgeInfoGrid">
            {sectionsFromObject.map((section, index) => (
              <div className="inforgeInfoCard" key={index}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h3>{section.title}</h3>
                <p>{section.body}</p>
              </div>
            ))}
          </div>
        );
      }

      return (
        <div className="inforgeFallbackText">
          {mainText
            .split(/\n+/)
            .filter(Boolean)
            .map((line, i) => (
              <p key={i}>{clean(line)}</p>
            ))}
        </div>
      );
    }

    // ----------------------------------------------------------
    // ADVISORY
    // ----------------------------------------------------------
    if (isAdvisory) {
      const labels = [
        "Situation",
        "Confirmed Information",
        "Key Dates / Numbers",
        "Key Dates/Numbers",
        "Unresolved Items",
        "Conflicting Information",
        "Risks / Implications",
        "Risks or Implications",
        "Verification / Action Points",
        "Recommended Verification / Action Points",
        "Status",
      ];

      let sections = objectSections(root);

      if (!sections.length) {
        sections = splitLabeledText(mainText, labels);
      }

      if (!sections.length && mainText) {
        sections = [{ title: "Advisory", body: mainText }];
      }

      return renderSectionCards(sections, "advisorySections");
    }

    // ----------------------------------------------------------
    // EXECUTIVE SUMMARY
    // ----------------------------------------------------------
    if (isExecutive) {
      const labels = [
        "Executive Overview",
        "Overview",
        "Key Facts",
        "Important Numbers",
        "Numbers",
        "Timeline",
        "Unresolved Items",
        "Conflicting Information",
        "Decision Considerations",
        "Final Factual Takeaway",
        "Takeaway",
      ];

      let sections = objectSections(root);

      if (!sections.length) {
        sections = splitLabeledText(mainText, labels);
      }

      if (!sections.length && mainText) {
        sections = [{ title: "Executive Summary", body: mainText }];
      }

      return renderSectionCards(sections, "executiveSections");
    }

    // ----------------------------------------------------------
    // LINKEDIN — readable paragraphs, no metadata leakage.
    // ----------------------------------------------------------
    if (isLinkedIn) {
      let text = mainText;

      const lines = text
        .split(/\n+/)
        .map((line) => clean(line))
        .filter(Boolean);

      const paragraphs: string[] = [];
      let current = "";

      for (const line of lines) {
        if (
          /^(core details|key milestones|unresolved items|conflicting cost figures|why does this matter|takeaway|confirmed information|timeline|final takeaway)\s*[:\-–—]?$/i.test(line)
        ) {
          if (current) {
            paragraphs.push(current);
            current = "";
          }
          paragraphs.push(line);
          continue;
        }

        current += `${current ? " " : ""}${line}`;

        if (/[.!?]$/.test(line) && current.length > 260) {
          paragraphs.push(current);
          current = "";
        }
      }

      if (current) paragraphs.push(current);

      return (
        <div className="inforgeLinkedIn">
          {paragraphs.map((paragraph, index) => {
            const isHeading =
              /^(core details|key milestones|unresolved items|conflicting cost figures|why does this matter|takeaway|confirmed information|timeline|final takeaway)\s*[:\-–—]?$/i.test(
                paragraph
              );

            if (isHeading) {
              return <h3 key={index}>{paragraph.replace(/[:\-–—]\s*$/, "")}</h3>;
            }

            return <p key={index}>{paragraph}</p>;
          })}
        </div>
      );
    }

    // ----------------------------------------------------------
    // Generic fallback.
    // ----------------------------------------------------------
    const sections = objectSections(root);

    if (sections.length) {
      return renderSectionCards(sections);
    }

    return (
      <div className="inforgeFallbackText">
        {mainText.split(/\n+/).filter(Boolean).map((line, i) => (
          <p key={i}>{clean(line)}</p>
        ))}
      </div>
    );
  }


  async function copyGeneratedOutput(...args: any[]) {
    const item =
      args.find(
        (value: any) =>
          value &&
          typeof value === 'object' &&
          (
            value.output_type ||
            value.content ||
            value.structured_output
          )
      ) || args[0];

    if (!item) return;

    const type = item?.output_type || '';
    const structured =
      item?.structured_output &&
      typeof item.structured_output === 'object'
        ? item.structured_output
        : null;

    let text = '';

    // X / THREAD: copy the actual thread, not UI metadata.
    if (
      type === 'X / THREAD' ||
      type === 'X' ||
      type === 'THREAD'
    ) {
      let posts: string[] = [];

      const rawPosts =
        structured?.posts ||
        structured?.thread ||
        structured?.tweets;

      if (Array.isArray(rawPosts)) {
        posts = rawPosts
          .map((post: any) => {
            if (typeof post === 'string') {
              return cleanPublishText(post);
            }

            return cleanPublishText(
              post?.text ||
              post?.content ||
              post?.body ||
              ''
            );
          })
          .filter(Boolean);
      }

      if (!posts.length && typeof item?.content === 'string') {
        posts = item.content
          .split(/\n(?=\s*\d+\s*\/\s*\d+)/)
          .map((post: string) =>
            cleanPublishText(
              post.replace(/^\s*\d+\s*\/\s*\d+\s*/, '')
            )
          )
          .filter(Boolean);
      }

      if (posts.length) {
        text = posts
          .map(
            (post, index) =>
              `${index + 1}/${posts.length}\n${post}`
          )
          .join('\n\n');
      }
    }

    // Normal outputs.
    if (!text) {
      if (typeof item?.content === 'string') {
        text = cleanPublishText(item.content);
      } else if (
        structured &&
        typeof structured.content === 'string'
      ) {
        text = cleanPublishText(structured.content);
      } else if (
        structured &&
        typeof structured.text === 'string'
      ) {
        text = cleanPublishText(structured.text);
      } else if (
        structured &&
        Array.isArray(structured.sections)
      ) {
        text = structured.sections
          .map((section: any) => sectionText(section))
          .filter(Boolean)
          .join('\n\n');
      }
    }

    if (!text) {
      text = getCleanPlatformText(item);
    }

    text = cleanPublishText(text);

    if (!text) {
      console.warn('Nothing publishable to copy.');
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      console.log('✅ Output copied.');
    } catch (error) {
      console.error('❌ Clipboard copy failed:', error);

      // Fallback for browsers where clipboard API is blocked.
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();

      try {
        document.execCommand('copy');
        console.log('✅ Output copied using fallback.');
      } finally {
        document.body.removeChild(textarea);
      }
    }
  }

  async function transform() {
    if (!data || selectedOutputs.length === 0) return;

    setLoading(true);
    setOutput(null);
    setGeneratedOutputs([]);

    try {
      const source = JSON.stringify({
        summary: data.context_summary,
        claims: data.claims,
        known: data.known,
        unknown: data.unknown,
        conflicting: data.conflicting,
        timeline: data.timeline,
        sources: data.sources,
        contradiction_graph: data.contradiction_graph
      });

      const results: any[] = [];

      for (const outputType of selectedOutputs) {
        try {
          const r = await fetch(`${API}/api/v1/transform`, {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({
              source_context: source,
              output_type: outputType,
              audience,
              language,
              tone,
              objective,
              detail,
              style: 'Clear',
              mode
            })
          });

          const json = await r.json();

          const result = r.ok
            ? json
            : {
                status: 'error',
                output_type: outputType,
                message:
                  json.detail ||
                  `${outputType} transformation failed`
              };

          results.push(result);

          // Show each completed output immediately.
          setGeneratedOutputs([...results]);
        } catch (e: any) {
          const failed = {
            status: 'error',
            output_type: outputType,
            message:
              e.message ||
              `${outputType} transformation failed`
          };

          results.push(failed);
          setGeneratedOutputs([...results]);
        }
      }

      setOutput(results[0] || null);
    } catch (e: any) {
      setOutput({
        status: 'error',
        message:
          e.message ||
          'Transformation failed'
      });
    } finally {
      setLoading(false);
    }
  }


  return (
    <main className="page">
      <Link className="back" href="/">← SYSTEM</Link>
      <div className="kicker" style={{marginTop:45}}>ENGINE / NEW INTELLIGENCE PROJECT</div>
      <h1 className="pageTitle">INGEST.<br/><span className="muted">UNDERSTAND.</span><br/>ACT.</h1>

      <div className="panel">
        <div className="upload">
          <label className="uploadLabel">
            <input key={fileInputKey} type="file" multiple accept=".pdf,.doc,.docx,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.webp" onChange={e => setFiles(Array.from(e.target.files || []))}/>
            <strong>{files.length ? `${files.length} SOURCE${files.length > 1 ? 'S' : ''} SELECTED` : 'DROP INFORMATION'}</strong>
            <span className="muted">PDF · DOCX · IMAGE · TEXT — multiple sources supported</span>
            {files.length > 0 && <span className="small" style={{display:'block',marginTop:8}}>{files.map(f => f.name).join(' · ')}</span>}
          </label>
        </div>

        <div style={{display:'flex',gap:10,marginTop:14,flexWrap:'wrap'}}>
          <input className="select" style={{flex:1,minWidth:280}} placeholder="Optional source URL — https://…" value={url} onChange={e=>setUrl(e.target.value)}/>
        </div>

        <div className="controls">
          <select className="select" value={mode} onChange={e=>setMode(e.target.value)}><option>AUTO</option><option>CRISIS</option><option>STANDARD</option></select>
          <select className="select" value={audience} onChange={e=>setAudience(e.target.value)}><option>Adaptive</option><option>Executives</option><option>Public</option><option>Students</option><option>Technical Team</option><option>Customers</option></select>
          <select className="select" value={language} onChange={e=>setLanguage(e.target.value)}><option>English</option><option>Hindi</option><option>Hinglish</option></select>
          <select className="select" value={tone} onChange={e=>setTone(e.target.value)}><option>Professional</option><option>Concise</option><option>Urgent</option><option>Educational</option><option>Conversational</option></select>
          <select className="select" value={objective} onChange={e=>setObjective(e.target.value)}><option>Inform</option><option>Persuade</option><option>Alert</option><option>Explain</option><option>Decide</option></select>
          <select className="select" value={detail} onChange={e=>setDetail(e.target.value)}><option>Short</option><option>Medium</option><option>Detailed</option></select>
        </div>

        <div style={{display:'flex',gap:10,marginTop:18,flexWrap:'wrap'}}>
          <button className="button" style={{border:0,cursor:'pointer'}} onClick={run} disabled={loading}>
            {loading ? 'PROCESSING…' : 'ANALYZE INFORMATION ↗'}
          </button>
          <button className="button" style={{cursor:'pointer'}} onClick={resetAnalysis} disabled={loading}>
            NEW ANALYSIS ↻
          </button>
        </div>
      </div>

      {data?.error && <div className="errorBox">{data.error}</div>}
      {data && !data.error && <div className="result">
        <div className="statGrid">{[['SOURCES',data.sources?.length||0],['ENTITIES',data.stats?.entities||0],['CLAIMS',data.stats?.claims||0],['EVENTS',data.stats?.events||0]].map(x=><div className="stat" key={x[0] as string}><span className="small">{x[0]}</span><b>{x[1]}</b></div>)}</div>

        {data.ingestion_notes?.length > 0 && <div className="warningText" style={{marginTop:18}}>⚠ {data.ingestion_notes.join(' · ')}</div>}
        {data.context_summary && <div className="passport" style={{marginTop:25}}><span className="badge">SOURCE INTELLIGENCE</span><p>{data.context_summary}</p></div>}

        <div className="triad" style={{marginTop:25}}>
          <div><h3 className="known">KNOWN / VERIFIED</h3>{(data.known||['None surfaced']).map((x:any,i:number)=><p key={i}>✓ {displayClaim(x)}</p>)}</div>
          <div><h3 className="unknown">UNKNOWN / UNRESOLVED</h3>{(data.unknown||['None surfaced']).map((x:any,i:number)=><p key={i}>? {displayClaim(x)}</p>)}</div>
          <div><h3 className="conflict">CONFLICTING / CHANGING</h3>{
  Array.isArray(data.conflicting)
    ? data.conflicting.map((x:any,i:number)=>
        <p key={i}>⚠ {displayConflict(x)}</p>
      )
    : data.conflicting
      ? <p>⚠ {displayConflict(data.conflicting)}</p>
      : <p className="muted">No conflicts surfaced.</p>
}</div>
        </div>

        {data.timeline?.length > 0 && <div className="passport" style={{marginTop:25}}><span className="badge">TEMPORAL TRUTH / TIMELINE</span>{data.timeline.map((t:any,i:number)=><p key={i}><b>{t.date || t.time || 'DATE'}</b> — {t.event || t.text || JSON.stringify(t)}</p>)}</div>}

        {data.contradiction_graph && <div className="passport" style={{marginTop:25}}><span className="badge">CONTRADICTION GRAPH</span><pre className="generated">{JSON.stringify(data.contradiction_graph,null,2)}</pre></div>}

        <div className="passport">
          <span className="badge">COMMUNICATION DECISION ENGINE</span>
          <h2>What should this information become?</h2>
          <p className="muted">INFORGE adapts verified information using audience, language, tone, objective and detail. You can override the decision.</p>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,marginTop:20,flexWrap:'wrap'}}>
            <span className="small">SELECT ANY NUMBER OF OUTPUTS</span>

            <div style={{display:'flex',gap:8}}>
              <button
                type="button"
                className="button"
                style={{padding:'8px 12px',fontSize:11}}
                onClick={selectAllOutputs}
                disabled={loading}
              >
                SELECT ALL
              </button>

              <button
                type="button"
                className="button"
                style={{padding:'8px 12px',fontSize:11}}
                onClick={clearOutputSelection}
                disabled={loading}
              >
                CLEAR
              </button>
            </div>
          </div>

          <div className="outputGrid">
            {outputs.map(([name,desc]) => (
              <button
                key={name}
                type="button"
                className={`outputCard ${selectedOutputs.includes(name) ? 'selected' : ''}`}
                onClick={() => toggleOutput(name)}
                disabled={loading}
              >
                <span className="small">
                  {selectedOutputs.includes(name) ? '✓ SELECTED' : 'SELECT'}
                </span>
                <strong>{name}</strong>
                <span className="outputDesc">{desc}</span>
              </button>
            ))}
          </div>

          <button
            className="button"
            style={{
              border:0,
              marginTop:20,
              cursor:selectedOutputs.length && !loading ? 'pointer' : 'not-allowed',
              opacity:selectedOutputs.length && !loading ? 1 : .5
            }}
            onClick={transform}
            disabled={loading || selectedOutputs.length === 0}
          >
            {loading
              ? `GENERATING ${selectedOutputs.length} OUTPUT${selectedOutputs.length === 1 ? '' : 'S'}…`
              : `GENERATE ${selectedOutputs.length} OUTPUT${selectedOutputs.length === 1 ? '' : 'S'} ↗`}
          </button>
        </div>

        {generatedOutputs.length > 0 && (
          <div style={{marginTop:25}}>
            <div className="passport">
              <span className="badge">CONTENT PASSPORT / GENERATED OUTPUTS</span>
              <h2>READY TO REVIEW / PUBLISH</h2>
              <p className="muted">
                {generatedOutputs.length} output{generatedOutputs.length === 1 ? '' : 's'} generated from the same verified information context.
              </p>
            </div>

            {generatedOutputs.map((item:any, index:number) => (
              <div className="passport output" key={`${item.output_type || 'output'}-${index}`} style={{marginTop:18}}>
                <span className="badge">
                  {item.output_type || 'GENERATED OUTPUT'}
                </span>

                <div className="generatedOutputHeader">
                  <div>
                    <h2>
                      {item.title ||
                        item.output_type ||
                        `Output ${index + 1}`}
                    </h2>

                    <span className="generatedOutputStatus">
                      SOURCE-BACKED · HUMAN REVIEW REQUIRED
                    </span>
                  </div>

                  {item.status === 'generated' && (
                    <button
                      type="button"
                      className="copyOutputButton"
                      onClick={(e) =>
                        copyGeneratedOutput(
                          item,
                          e.currentTarget as HTMLButtonElement
                        )
                      }
                    >
                      {['X', 'THREAD', 'X / THREAD'].includes(
                        String(item.output_type || '').toUpperCase()
                      )
                        ? 'COPY THREAD'
                        : 'COPY OUTPUT'}
                    </button>
                  )}
                </div>

                {item.status === 'error' && (
                  <div className="warningText">
                    ⚠ {item.message || 'Generation failed'}
                  </div>
                )}

                {item.status === 'configuration_required' && (
                  <div className="warningText">
                    {item.message}
                  </div>
                )}

                {item.status === 'generated' && (
                  <div className="generatedReadable">
                    {renderGeneratedContent(item)}
                  </div>
                )}

                {item.warnings?.length > 0 && (
                  <div className="warningText" style={{marginTop:18}}>
                    ⚠ {item.warnings.join(' · ')}
                  </div>
                )}

                <div className="passport" style={{marginTop:24}}>
                  <span className="badge">PROVENANCE / CONTENT PASSPORT</span>

                  <div className="statGrid" style={{marginTop:18}}>
                    <div className="stat">
                      <span className="small">AI GENERATED</span>
                      <b>{item.passport?.ai_generated ? 'YES' : 'NO'}</b>
                    </div>

                    <div className="stat">
                      <span className="small">MODEL</span>
                      <b>{item.passport?.model || item.model || 'N/A'}</b>
                    </div>

                    <div className="stat">
                      <span className="small">HUMAN REVIEW</span>
                      <b>{item.passport?.human_review_required ? 'REQUIRED' : 'NOT REQUIRED'}</b>
                    </div>

                    <div className="stat">
                      <span className="small">GENERATED</span>
                      <b>{formatPassportDate(item.passport?.generated_at)}</b>
                    </div>
                  </div>

                  <div style={{marginTop:22}}>
                    <h3>SOURCE TRACEABILITY</h3>

                    {(data?.sources || []).map((source:any, i:number) => (
                      <p key={source.id || i}>
                        • {source.name || 'Unnamed source'}
                        {source.type ? ` · ${source.type}` : ''}
                      </p>
                    ))}

                    {!data?.sources?.length && (
                      <p className="muted">
                        No source metadata available.
                      </p>
                    )}
                  </div>

                  <div style={{marginTop:22}}>
                    <h3>CLAIMS CARRIED INTO OUTPUT</h3>

                    {(data?.known || []).slice(0,12).map((claim:any,i:number) => (
                      <p key={i}>✓ {displayClaim(claim)}</p>
                    ))}

                    {!data?.known?.length && (
                      <p className="muted">
                        No verified claims available.
                      </p>
                    )}
                  </div>

                  <div style={{marginTop:22}}>
                    <h3>UNCERTAINTIES CARRIED FORWARD</h3>

                    {(data?.unknown || []).slice(0,12).map((item:any,i:number) => (
                      <p key={i}>? {displayClaim(item)}</p>
                    ))}

                    {!data?.unknown?.length && (
                      <p className="muted">
                        No unresolved items surfaced.
                      </p>
                    )}
                  </div>

                  <div style={{marginTop:22}}>
                    <h3>CONFLICTS CARRIED FORWARD</h3>

                    {Array.isArray(data?.conflicting)
                      ? data.conflicting.slice(0,12).map((item:any,i:number) => (
                          <p key={i}>⚠ {displayConflict(item)}</p>
                        ))
                      : data?.conflicting
                        ? <p>⚠ {displayConflict(data.conflicting)}</p>
                        : <p className="muted">No conflicts surfaced.</p>
                    }
                  </div>

                  <div className="warningText" style={{marginTop:22}}>
                    Human review required · Source traceability retained · AI transformation recorded
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>}
    </main>
  );
}
