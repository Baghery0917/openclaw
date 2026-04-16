let runtime = null;
export function setYuanbaoRuntime(next) {
    runtime = next;
}
export function getYuanbaoRuntime() {
    if (!runtime) {
        throw new Error('Yuanbao runtime not initialized');
    }
    return runtime;
}
