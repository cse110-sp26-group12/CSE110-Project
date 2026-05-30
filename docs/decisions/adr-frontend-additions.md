# Configuration for the Jekyll template "Just the Docs"

parent: Decisions
nav_order: 100
title: Design and Implement Individual Frontend Pages

# status: "accepted"

# date: 2026-05-29

# decision-makers: Varsha Jawadi, Alex Twano, Nathan Scott

# informed: Yanbai Li

---

<!-- markdownlint-disable-next-line MD025 -->

# Design and Implement Individual Frontend Pages

## Context and Problem Statement

Now that we have designed and implemented a foundation for the frontend, we need to design the remaining tabs to view and create tasks, add team members, and view blockers. These features are intended to supplement the core Daily StandUp functionality and provide additional ways of visualizing task progress and blockages. 

The main problem is deciding on a layout for each of these remaining tabs to create a streamlined user experience, as well as remaining flexible so as to not overwhelm the backend implementation. Additionally, we must decide the level of completeness to which we should implement these tabs, considering factors such as data creation, data storage, and interdependencies between tabs.

## Decision Drivers

- The front end must remain flexible depending on the backend team's capacity for new features.
- The implementation strategy must allow the frontend team to visually test these features without being blocked by other teams. 

## Considered Options

- Implement all functional interactions for all necessary tabs.
- Implement static prototype views with no interaction.
- Implement basic UI and create an API for the backend to handle data.

## Decision Outcome

Chosen option: "Implement basic UI and create an API for the backend to handle data". This option allows the frontend team to reach a mostly "complete" state for the user interface without being blocked by the backend team. At the same time, keeping the implementation basic means less work will be wasted in the event that we need to cut one or more of these features. 

## More Information

All design information for the Team Board, Task, and Blockers tabs of the product can be found under '[Descriptions of all planned pages/tabs](https://github.com/cse110-sp26-group12/CSE110-Project/blob/implement/frontend-foundation/docs/decisions/frontend-design.md#descriptions-of-all-planned-pagestabs)' in frontend-design.md. 
