export function createStandup(name, done, todo, blockers) {
    return {
        name,
        done,
        todo,
        blockers,
        submittedAt: new Date().toISOString(),
    };
}