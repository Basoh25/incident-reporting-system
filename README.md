\# Cybersecurity Incident Reporting System



This is my final year diploma project. It's a system that lets people report suspicious activity (phishing, malware, unauthorized access, etc.) and lets an admin track and investigate those reports.



I built it because most small organizations don't really have a proper way for staff to report security issues — it usually just gets mentioned to a manager informally and then nobody follows up on it. This gives it an actual paper trail.



\## What it does



Regular users can:

\- Create an account and log in

\- Submit an incident report (title, category, severity, description, plus contact info)

\- See the status of their own reports



Admins can:

\- See every report from every user

\- Filter by status or severity

\- Open a report and change its status (investigating, resolved, etc.)

\- See a basic summary of how many incidents are in each state



Every time a report is created or its status changes, it gets logged with a timestamp so there's a full history of what happened to it.



\## Tech used



Node.js + Express for the backend, MySQL for the database, plain HTML/CSS/JS on the frontend (didn't use React or anything, wanted to keep it simple and something I could fully explain).



For passwords I used bcrypt (well, bcryptjs — the regular bcrypt package needed native compilation tools I didn't want to deal with on Windows). Sessions are handled with express-session, stored in MySQL rather than just a cookie, so logging out actually kills the session server-side.



\## Some of the security stuff I focused on



Since the project is specifically about database security, authentication, and access control, I tried to actually get these right instead of just having a login form:



\- Passwords are hashed, never stored as plain text

\- Every admin-only route checks the user's role on the server, not just hiding a button in the frontend

\- Users can only see their own reports — I tested this by making a second account and trying to view another user's report by changing the ID in the URL, it correctly blocks it (this is a known vuln type called IDOR)

\- All the database queries use parameterized statements so user input can't mess with the SQL



\## Running it locally



You'll need Node.js and MySQL installed first.



```bash

git clone https://github.com/Basoh25/incident-reporting-system.git

cd incident-reporting-system

mysql -u root -p < db/schema.sql

cp env.example .env

```



Then open `.env` and fill in your database password etc.



```bash

npm install

node db/seed.js

npm start

```



Go to `http://localhost:3000`. The seed script creates a default admin account:

admin@example.com

Admin@123

(change this if you're actually deploying it anywhere)



\## Folder layout

config/db.js - database connection

db/schema.sql - the table structure

db/seed.js - creates the admin account

middleware/auth.js - login/role checks

routes/ - the actual API endpoints (auth, incidents, admin)

public/ - frontend pages

server.js - starts everything





\## Known limitations



No email notifications when a report's status changes, no file attachments yet, and password reset isn't implemented — currently if someone forgets their password an admin would need to sort it out manually. These are things I'd add if I had more time.



