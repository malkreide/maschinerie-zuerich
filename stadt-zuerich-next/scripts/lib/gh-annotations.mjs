// GitHub-Actions-Annotations («Workflow Commands») für Validator-Meldungen.
//
// Warnungen brechen den Build nicht ab und stünden sonst nur im Job-Log, wo
// sie niemand liest. Als `::warning`-Zeile auf stdout zeigt GitHub sie in der
// Check-Zusammenfassung des Pull Requests und — wenn die Datei im Diff ist —
// direkt an der Datei.
//
// Eigenes Modul, damit das Escaping unit-testbar ist
// (tests/gh-annotations.test.mjs): Meldungen enthalten Zitate aus den
// Prozessdaten, also beliebigen Text mit «%», «:» und «,».
//
// Format und Escaping gemäss GitHub-Doku «Workflow commands for GitHub
// Actions»: im Text %, CR, LF; in Property-Werten zusätzlich «:» und «,».

const escapeData = (s) =>
  String(s).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');

const escapeProperty = (s) =>
  escapeData(s).replace(/:/g, '%3A').replace(/,/g, '%2C');

/** Läuft der Prozess in GitHub Actions? */
export function inGitHubActions(env = process.env) {
  return env.GITHUB_ACTIONS === 'true';
}

/**
 * Baut eine Annotation-Zeile.
 * @param {'warning'|'error'|'notice'} level
 * @param {string} message
 * @param {{ file?: string, title?: string }} [props] `file` relativ zum
 *   Repo-Root (GITHUB_WORKSPACE); Backslashes werden zu «/».
 */
export function ghAnnotation(level, message, { file, title } = {}) {
  const props = [];
  if (file) props.push(`file=${escapeProperty(file.replace(/\\/g, '/'))}`);
  if (title) props.push(`title=${escapeProperty(title)}`);
  return `::${level}${props.length ? ` ${props.join(',')}` : ''}::${escapeData(message)}`;
}
