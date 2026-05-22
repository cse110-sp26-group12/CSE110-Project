# Most important Features

1. Daily Digest - A summary view that aggregates the day's check-ins into one digestible snapshot. This could be a page that shows the team's status for a given day.
2. Smart Check-ins - This is the heart of the project prompt. Async daily check-ins where each team member reports what they did, what they're doing next, and any blockers. This directly answers "have we checked in today?" and "what is everyone doing?"
3. Blockers - The prompt explicitly calls out blockers. A simple system to flag and surface blockers so the team can see who needs help.
4. Mood/Wellbeing Signal — Not explicitly in Steady's list, but the prompt asks "are we feeling bad?" and "do we need someone to cover for us?" A simple mood indicator during check-in (like a 1–5 scale or emoji) would be a thoughtful addition that directly addresses the prompt.
5. Project Planning and tracking - Plan Projects and track them - plan out features for spec driven development - plan out user stories - etc.

# Nice to have Features (if we have time)

1. Scheduling/Availability - The prompt asks "when can we all meet?" Some kind of availability view or meeting coordination feature would fit well.
2. Activity Integrations — Since you're already using GitHub, pulling in commit or PR activity to auto-enrich check-ins would be impressive and relevant. This is feasible with the GitHub API since it doesn't require a backend beyond what Cloudflare Workers could handle.
