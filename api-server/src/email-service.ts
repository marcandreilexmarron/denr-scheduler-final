
import "dotenv/config";
import nodemailer from "nodemailer";
import { readUsers } from "./storage-select.js";

function formatDate(dateStr: string): string {
  if (!dateStr) return "N/A";
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatTime(timeStr: string): string {
  if (!timeStr) return "";
  try {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes);
    return date.toLocaleTimeString("en-US", { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch {
    return timeStr;
  }
}

function buildParticipantsHTML(event: any): string {
  const raw = Array.isArray(event.participants) ? event.participants : [];
  if (!raw.length) return "N/A";
  const byOffice = new Map<string, Set<string>>();
  const officeOnly = new Set<string>();
  for (const p of raw) {
    const s = String(p || "").trim();
    if (!s) continue;
    if (s.includes(" — ")) {
      const parts = s.split(" — ");
      const emp = parts[0].trim();
      const off = parts.slice(1).join(" — ").trim();
      if (!byOffice.has(off)) byOffice.set(off, new Set<string>());
      if (emp) byOffice.get(off)!.add(emp);
    } else {
      officeOnly.add(s);
    }
  }
  const sections: string[] = [];
  for (const [off, empsSet] of Array.from(byOffice.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    const emps = Array.from(empsSet.values()).sort((a, b) => a.localeCompare(b));
    sections.push(`<div><strong>${off}</strong><ul>${emps.map((e) => `<li>${e}</li>`).join("")}</ul></div>`);
  }
  if (officeOnly.size) {
    const offices = Array.from(officeOnly.values()).sort((a, b) => a.localeCompare(b));
    sections.push(`<div><strong>Offices</strong><ul>${offices.map((o) => `<li>${o}</li>`).join("")}</ul></div>`);
  }
  return sections.join("");
}
console.log("SMTP User:", process.env.SMTP_USER);
console.log("SMTP Pass:", process.env.SMTP_PASS ? "Loaded" : "Not Loaded");

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

  const attachments = (event.attachments || []).map((att: any) => {
    if (att.blob) {
      const [header, data] = att.blob.split(',');
      return { filename: att.name, content: data, encoding: 'base64', contentType: att.type };
    }
    return null;
  }).filter(Boolean);

  const html = `
    <h2>New Event Scheduled</h2>
    <p><strong>Title:</strong> ${event.title}</p>
    <p><strong>Date:</strong> ${event.dateType === 'range' ? `${formatDate(event.startDate)} to ${formatDate(event.endDate)}` : formatDate(event.date)}</p>
    <p><strong>Time:</strong> ${event.startTime ? `${formatTime(event.startTime)} - ${formatTime(event.endTime)}` : 'All day'}</p>
    <p><strong>Venue:</strong> ${event.location || 'N/A'}</p>
    <p><strong>Participants:</strong><br/>${buildParticipantsHTML(event)}</p>
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
      attachments
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
    <p><strong>Date:</strong> ${event.dateType === 'range' ? `${formatDate(event.startDate)} to ${formatDate(event.endDate)}` : formatDate(event.date)}</p>
    <p><strong>Time:</strong> ${event.startTime ? `${formatTime(event.startTime)} - ${formatTime(event.endTime)}` : 'All day'}</p>
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
