// Stands in for the `herdr` module. A test sets what it answers through `host`.

const fresh = () => ({ agents: [], terminals: [], props: null, sounds: { enabled: true }, zoom: 1, ran: [], played: [], order: [] });

export const host = { ...fresh(), reset() { Object.assign(host, fresh()); } };

export const agents = () => host.agents;
export const terminals = () => host.terminals;
export const props = () => host.props;
export const settings = () => ({ sounds: host.sounds, zoom: host.zoom });
export const playSound = (file) => { host.played.push(file); return null; };
export const run = (name, args) => { host.ran.push([name, args]); return null; };
export const setAgentOrder = (list) => { host.order = list; return null; };
export const window = () => null;
export const nextCommand = () => new Promise(() => {});
