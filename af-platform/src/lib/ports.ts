/**
 * Port label utilities.
 * Port data is fetched once and cached in module scope.
 */

export interface Terminal {
  terminal_id: string;
  name: string;
  is_default: boolean;
}

export interface Port {
  un_code: string;
  name: string;
  country: string;
  country_code: string;
  port_type: string;
  has_terminals: boolean;
  terminals: Terminal[];
}

let _portsCache: Port[] | null = null;

export async function fetchPorts(): Promise<Port[]> {
  if (_portsCache) return _portsCache;
  const res = await fetch("/api/v2/ports");
  if (!res.ok) return [];
  _portsCache = await res.json();
  return _portsCache!;
}

/**
 * Returns display label for a port code.
 * e.g. getPortLabel("MYPKG", undefined, ports) → "Port Klang, Malaysia"
 * e.g. getPortLabel("MYPKG", "MYPKG_N", ports) → "Port Klang (Northport), Malaysia"
 */
export function getPortLabel(unCode: string | null | undefined, terminalId: string | null | undefined, ports: Port[]): string {
  if (!unCode) return "";
  const port = ports.find(p => p.un_code === unCode);
  if (!port) return unCode;

  let label = port.name;
  if (terminalId && port.has_terminals) {
    const terminal = port.terminals.find(t => t.terminal_id === terminalId);
    if (terminal) label += ` (${terminal.name})`;
  }
  label += `, ${port.country}`;
  return label;
}
