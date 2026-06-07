# Configuration for the Jekyll template "Just the Docs"

parent: Decisions
nav_order: 100
title: Use Plain HTML CSS and JavaScript for Daily StandUp Dashboard

# status: "accepted"

# date: 2026-05-19

# decision-makers: Team members

# consulted: Team members

# informed: Team members

---

<!-- markdownlint-disable-next-line MD025 -->

# Use Plain HTML, CSS, and JavaScript for the Daily StandUp Dashboard

## Context and Problem Statement

Our project needs a Daily StandUp Dashboard where team members can submit their updates, see recent team reports, and quickly check the team’s progress. The dashboard includes a standup form, a list of submitted updates, summary numbers, a dark mode button, and placeholder sections for future features like tasks, blockers, team board, and archive.

The main problem is deciding how to build this feature in a way that is clear, simple, and easy for the team to maintain. Since this is a front-end assignment, we want the project to be interactive, but we do not want to make it more complicated than necessary.

## Decision Drivers

- The code should be easy for team members to read and understand.
- The page should have a clean layout and a professional visual style.
- Users should be able to submit standup updates without refreshing the page.
- The dashboard should show useful summary information, such as submissions, blockers, and tasks in progress.
- The design should support dark mode.
- The project should be easy to expand later.
- The project should not require unnecessary frameworks or setup.

## Considered Options

- Use plain HTML, CSS, and JavaScript
- Use a front-end framework such as React
- Build a mostly static page with little or no JavaScript

## Decision Outcome

Chosen option: "Use plain HTML, CSS, and JavaScript", because this option gives us enough functionality while still keeping the project simple. HTML is used for the page structure, CSS is used for the layout and visual design, and JavaScript is used for the interactive parts of the dashboard.

This choice fits the current size of the project well. The dashboard does not need a full front-end framework yet, because the main features are simple: toggling dark mode, checking form input, creating standup cards, updating the summary counts, and clearing the form after submission.

### Consequences

- Good, because the project is simple and easy to understand.
- Good, because each file has a clear purpose: HTML for structure, CSS for styling, and JavaScript for behavior.
- Good, because users can submit standup updates and see them appear on the page immediately.
- Good, because the CSS variables make the light and dark themes easier to manage.
- Good, because the project can be expanded later with local storage, a backend, or more dashboard sections.
- Bad, because the submitted updates are not saved after the page reloads.
- Bad, because plain JavaScript may become harder to organize if the app becomes much larger.

### Confirmation

We can confirm this decision by testing the dashboard in the browser. A user should be able to enter their name, yesterday’s work, today’s plan, choose a status, add blockers if needed, and submit the form. After submission, a new standup card should appear in the Team Updates section.

We should also check that the summary numbers update correctly, the empty state disappears after the first submission, the dark mode button changes the page theme, and the layout still works on smaller screens.

## Pros and Cons of the Options

### Use plain HTML, CSS, and JavaScript

This option builds the dashboard with normal front-end files. The HTML file creates the page content, the CSS file controls the visual design, and the JavaScript file handles the user interaction.

- Good, because it is simple and does not need extra setup.
- Good, because it is easier for every team member to read and edit.
- Good, because it is enough for the current dashboard features.
- Good, because the project stays lightweight.
- Neutral, because this approach is fine for a small project but may need better organization later.
- Bad, because the data only exists during the current page session.

### Use a front-end framework such as React

This option would build the dashboard with components and state management.

- Good, because components can make a larger app easier to organize.
- Good, because state updates may be cleaner if the dashboard becomes more complex.
- Neutral, because React could be useful in a future version.
- Bad, because it adds more setup than this project needs.
- Bad, because the current dashboard features are simple enough to build without a framework.

### Build a mostly static page with little or no JavaScript

This option would focus mostly on the visual layout. The form and dashboard could be shown, but the page would not have much real interaction.

- Good, because it would be the easiest version to build.
- Good, because there would be less JavaScript to debug.
- Bad, because users would not be able to submit updates into the dashboard.
- Bad, because the summary numbers would not update.
- Bad, because the dashboard would feel incomplete and less useful.

## More Information

This decision matches the current project structure. The HTML file includes the navbar, hero section, summary cards, standup form, update list, and future placeholder sections. The CSS file creates the warm visual style, responsive layout, cards, buttons, status indicators, and dark mode theme. The JavaScript file adds the main interactive behavior, including form validation, dark mode, creating update cards, and updating the dashboard counts.

In a future version, this decision can be revisited if the project needs saved data, user accounts, a database, or more complex task management features.
