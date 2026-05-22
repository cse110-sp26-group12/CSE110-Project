import { createStandupStore } from '../src/standupStore';

describe('standupStore', () => {
    it('should add a standup and return it', () => {
        const store = createStandupStore();
        const standup = store.add('Kyle', 'closed issue 11', 'pick up issue 20', 'none');

        expect(standup.name).toBe('Kyle');
        expect(standup.done).toBe('closed issue 11');
        expect(standup.todo).toBe('pick up issue 20');
        expect(standup.blockers).toBe('none');
        expect(new Date(standup.submittedAt)).toBeInstanceOf(Date);
        expect(store.getAll()).toHaveLength(1);
    });

    it('serialize returns valid JSON with all stored standups', () => {
        const store = createStandupStore();
        store.add('Varsha', 'frontend design doc', 'review issues', 'none');
        store.add('Kyle', 'json store', 'open pr', 'none');

        const result = JSON.parse(store.serialize());
        expect(result).toHaveLength(2);
        expect(result[0].name).toBe('Varsha');
        expect(result[1].name).toBe('Kyle');
    });

    it('serialize returns [] for an empty store', () => {
        expect(createStandupStore().serialize()).toBe('[]');
    });
});
