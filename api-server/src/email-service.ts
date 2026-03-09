
import nodemailer from "nodemailer";
import { readUsers } from "./storage-select.js";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.ethereal.email",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Helper to find emails for a list of office names
async function getEmailsForOffices(officeNames: string[]): Promise<string[]> {
  const users = await readUsers();
  const emails = new Set<string>();

  // Normalize helper
  const norm = (s: string) => s.trim().toLowerCase();
  const targetOffices = new Set(officeNames.map(norm));

  for (const u of users) {
    if (u.email && u.officeName && targetOffices.has(norm(u.officeName))) {
      emails.add(u.email);
    }
  }
  return Array.from(emails);
}

// Helper to get sender email based on creator info
async function getSenderEmail(event: any): Promise<string> {
  const defaultFrom = process.env.SMTP_FROM || '"DENR Scheduler" <no-reply@denr.gov.ph>';
  
  // If we have createdBy (username), try to find their email
  if (event.createdBy) {
    const users = await readUsers();
    const creator = users.find(u => u.username === event.createdBy);
    if (creator && creator.email) {
        // We still use the SMTP_USER auth, but set the 'Reply-To' header
        // or 'From' header if the SMTP server allows spoofing (often it doesn't).
        // Best practice is to set 'From' as system email, and 'Reply-To' as creator.
        // However, if the user explicitly wants the creator to be the sender:
        return `"${event.createdByOffice || creator.officeName || event.createdBy}" <${creator.email}>`;
    }
  }
  return defaultFrom;
}

export async function sendEventCreatedEmail(event: any) {
  const officeName = event.office || event.createdByOffice;
  const participants = Array.isArray(event.participants) ? event.participants : [];
  
  // Extract office names from participants list
  // Participants can be "Office Name" or "Person Name — Office Name"
  const involvedOffices: string[] = [];
  if (officeName) involvedOffices.push(officeName);
  
  // Ensure the creator's office is always included in the recipients list,
  // so they receive a copy of the email even if they are the sender.
  if (event.createdByOffice && !involvedOffices.includes(event.createdByOffice)) {
    involvedOffices.push(event.createdByOffice);
  }
  
  for (const p of participants) {
    if (typeof p === "string") {
      if (p.includes(" — ")) {
        const parts = p.split(" — ");
        involvedOffices.push(parts[1].trim());
      } else {
        involvedOffices.push(p);
      }
    }
  }

  const recipients = await getEmailsForOffices(involvedOffices);
  if (recipients.length === 0) {
    console.log("No email recipients found for event:", event.title);
    return;
  }

  const sender = await getSenderEmail(event);
  const subject = `New Event: ${event.title}`;
  const html = `
    <h2>New Event Created</h2>
    <p><strong>Title:</strong> ${event.title}</p>
    <p><strong>Date:</strong> ${event.dateType === 'range' ? `${event.startDate} to ${event.endDate}` : event.date}</p>
    <p><strong>Time:</strong> ${event.startTime || 'All day'} - ${event.endTime || ''}</p>
    <p><strong>Venue:</strong> ${event.location || 'N/A'}</p>
    <p><strong>Description:</strong><br/>${event.description || 'N/A'}</p>
    <p><strong>Created By:</strong> ${event.createdBy || 'Unknown'} (${event.createdByOffice || 'Unknown'})</p>
  `;

  try {
    const info = await transporter.sendMail({
      from: sender, // Note: Some SMTP servers (like Gmail) overwrite this with the authenticated user
      replyTo: sender, // This ensures replies go to the creator
      to: recipients,
      subject,
      html,
    });
    console.log(`Event created email sent to: ${recipients.join(", ")} (ID: ${info.messageId})`);
  } catch (err) {
    console.error("Failed to send event created email:", err);
  }
}

export async function sendReminderEmail(event: any) {
  const officeName = event.office || event.createdByOffice;
  const participants = Array.isArray(event.participants) ? event.participants : [];
  
  const involvedOffices: string[] = [];
  if (officeName) involvedOffices.push(officeName);

  // Ensure the creator's office is always included in the recipients list
  if (event.createdByOffice && !involvedOffices.includes(event.createdByOffice)) {
    involvedOffices.push(event.createdByOffice);
  }
  
  for (const p of participants) {
    if (typeof p === "string") {
      if (p.includes(" — ")) {
        const parts = p.split(" — ");
        involvedOffices.push(parts[1].trim());
      } else {
        involvedOffices.push(p);
      }
    }
  }

  const recipients = await getEmailsForOffices(involvedOffices);
  if (recipients.length === 0) return;

  const sender = await getSenderEmail(event);
  const subject = `Reminder: Upcoming Event - ${event.title}`;
  const html = `
    <h2>Event Reminder</h2>
    <p>This is a reminder that the following event is coming up in 3 days:</p>
    <p><strong>Title:</strong> ${event.title}</p>
    <p><strong>Date:</strong> ${event.dateType === 'range' ? `${event.startDate} to ${event.endDate}` : event.date}</p>
    <p><strong>Time:</strong> ${event.startTime || 'All day'} - ${event.endTime || ''}</p>
    <p><strong>Venue:</strong> ${event.location || 'N/A'}</p>
  `;

  try {
    const info = await transporter.sendMail({
      from: sender,
      replyTo: sender,
      to: recipients,
      subject,
      html,
    });
    console.log(`Reminder email sent to: ${recipients.join(", ")} (ID: ${info.messageId})`);
  } catch (err) {
    console.error("Failed to send reminder email:", err);
  }
}
