const activeClients = new Map();
export function setActiveWsClient(accountId, client) {
    if (client) {
        activeClients.set(accountId, client);
    }
    else {
        activeClients.delete(accountId);
    }
}
export function getActiveWsClient(accountId) {
    return activeClients.get(accountId) ?? null;
}
export function getAllActiveWsClients() {
    return activeClients;
}
