# Peer Review — Team 13 (SE SitRep)

Reviewing team: Group 12. Repo reviewed: cse110-sp26-group13/CSE-110-SE-SitRep.

## Strength

The repo was pretty easy to land in and actually figure out, which isn't always how it goes this late in the quarter, and a big part of that is that the README does a good job of explaining what the project even is to begin with (the daily standup, blockers and availability dashboard idea), so I wasn't sitting there trying to piece it together. The file structure made sense to me too since the css and js are both split up by feature instead of everything getting dumped into one giant file, and on top of that there's a real paper trail with the sprint planning, the standup notes folder, and the ADRs, so it was pretty clear to me that the team is tracking the process side and not just the code, which I think is a big part of what this class is actually looking for.

## Improvements

1. One thing is that the quick start in the README feels kind of out of date with where the project actually is right now, since it says it's a static site with no build step and to just open index.html, but there's a package.json in there now with stuff like eslint and playwright, and when I actually went to open index.html it looks like it sends you to a login/splash page first, so someone just following the README the way it's written would probably get stuck pretty fast, and I think updating that section so the setup matches what the app needs now would clear it up.

2. The other thing is that it was kind of hard for me to tell what's actually working right now versus what's still planned or running on mock data, since the features list reads like everything is already live, but from poking around it seemed like some of it (the GitHub issues part especially) is still in progress, so to me even a short "what's working so far" note would go a long way in making it easier to know what to actually look at.

## Question

The GitHub issues integration seemed like the most ambitious piece to me so I was curious how far along it actually is, since I couldn't really tell from the outside, does it connect to a real repo and pull live issues yet or is it still running off the mock data in data.js for now? I ask since that one feels like it has the most going on and I wasn't totally sure what state it was in.

## Suggestion

I think it would help a lot to throw a screenshot or two of the dashboard into the README, since right now the only way to really see what it looks like is to sit through the whole status video, and a couple of images would let someone get the idea in a few seconds instead, and pairing that with a quick line about what you actually need to set up to run it locally would round the README out nicely.
