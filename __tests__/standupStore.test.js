import { createStandupStore } from '../src/standupStore';

describe('standupStore', () => {
    it('should add a standup and return it', () => {
        const store = createStandupStore();
        const entry = store.add('Kyle', 'closed issue 11', 'pick up issue 20', 'none');

        expect(entry.name).toBe('Kyle');
        expect(entry.done).toBe('closed issue 11');
        expect(entry.todo).toBe('pick up issue 20');
        expect(entry.blockers).toBe('none');
        expect(new Date(entry.submittedAt)).toBeInstanceOf(Date);
        expect(store.getAll()).toHaveLength(1);
    });

    it('should return a defensive copy from getAll', () => {
        const store = createStandupStore();
        store.add('Cedric', 'a', 'b', 'c');
        const snapshot = store.getAll();
        snapshot.push('not a standup');

        expect(store.getAll()).toHaveLength(1);
    });

    it('should serialize all standups to pretty JSON', () => {
        const store = createStandupStore();
        store.add('Varsha', 'frontend design doc', 'review issues', 'none');
        store.add('Kyle', 'json store', 'open pr', 'none');

        const parsed = JSON.parse(store.toJSON());
        expect(parsed).toHaveLength(2);
        expect(parsed[0].name).toBe('Varsha');
        expect(parsed[1].name).toBe('Kyle');
    });

    it('should empty the store on clear', () => {
        const store = createStandupStore();
        store.add('a', 'b', 'c', 'd');
        store.add('e', 'f', 'g', 'h');
        expect(store.getAll()).toHaveLength(2);

        store.clear();
        expect(store.getAll()).toHaveLength(0);
    });
});
