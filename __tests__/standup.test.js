import { createStandup } from '../src/standup';

describe('createStandup', () => {
    it('should create a standup object with the correct properties', () => {
        const standup = createStandup(
            'Cedric', 
            'Took Ibuprofen for headache', 
            'Sleep', 
            'Fever'
        );

        expect(standup.name).toBe('Cedric');
        expect(standup.done).toBe('Took Ibuprofen for headache');
        expect(standup.todo).toBe('Sleep');
        expect(standup.blockers).toBe('Fever');
        expect(new Date(standup.submittedAt)).toBeInstanceOf(Date);
    });
});