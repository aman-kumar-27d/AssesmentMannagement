# First Major Application Explanation

**Name:** Secure Notepad Assessment Platform

**What the application does:** A comprehensive web platform for conducting secure online assessments with built-in anti-cheating measures including copy-paste prevention, tab switching detection, and context menu disabling.

**Inputs:** Student registrations, admin-created assessments with questions (MCQ/text), student answers and submissions, user authentication credentials, and assessment configurations.

**Outputs:** Graded assessments, student performance reports, submission tracking, feedback from instructors, and detailed analytics on student behavior during tests.

**Tech Stack:** Frontend - React with TypeScript, TailwindCSS, React Router, Context API; Backend - Node.js with Express.js, MongoDB with Mongoose, JWT authentication, RESTful APIs.

**Main Challenges:** Implementing robust anti-cheating mechanisms (preventing copy-paste, detecting tab switches), ensuring secure authentication and authorization, maintaining real-time session management, handling concurrent user submissions, and creating a responsive UI that works across different devices while maintaining security constraints.