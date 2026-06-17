import "dotenv/config";
import { Resend } from "resend";
import fs from "fs";
import path from "path";
import { readUsers, getDataDir } from "./storage-select.js";
const resend = new Resend(process.env.RESEND_API_KEY);
function formatDate(dateStr) {
    if (!dateStr)
        return "N/A";
    try {
        const [year, month, day] = dateStr.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        return date.toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' });
    }
    catch {
        return dateStr;
    }
}
function formatTime(timeStr) {
    if (!timeStr)
        return "";
    try {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const date = new Date();
        date.setHours(hours, minutes);
        return date.toLocaleTimeString("en-US", { hour: 'numeric', minute: '2-digit', hour12: true });
    }
    catch {
        return timeStr;
    }
}
function buildParticipantsHTML(event) {
    const raw = Array.isArray(event.participants) ? event.participants : [];
    const tokensRaw = Array.isArray(event.participantTokens) ? event.participantTokens : [];
    const hasReferToken = tokensRaw.some((t) => String(t || "").trim().toLowerCase() === "refer to attachments");
    if (!raw.length && !hasReferToken)
        return "N/A";
    const byOffice = new Map();
    const officeOnly = new Set();
    for (const p of raw) {
        const s = String(p || "").trim();
        if (!s)
            continue;
        if (s.includes(" — ")) {
            const parts = s.split(" — ");
            const emp = parts[0].trim();
            const off = parts.slice(1).join(" — ").trim();
            if (!byOffice.has(off))
                byOffice.set(off, new Set());
            if (emp)
                byOffice.get(off).add(emp);
        }
        else {
            officeOnly.add(s);
        }
    }
    const sections = [];
    if (hasReferToken) {
        sections.push(`<div style="margin:0 0 10px 0;">Refer to attachments.</div>`);
    }
    for (const [off, empsSet] of Array.from(byOffice.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
        const emps = Array.from(empsSet.values()).sort((a, b) => a.localeCompare(b));
        sections.push(`<div><strong>${off}</strong><ul style="margin:4px 0 10px 18px; padding:0;">${emps.map((e) => `<li style="margin:2px 0;">${e}</li>`).join("")}</ul></div>`);
    }
    if (officeOnly.size) {
        const offices = Array.from(officeOnly.values()).sort((a, b) => a.localeCompare(b));
        sections.push(`<div><strong>Offices</strong><ul style="margin:4px 0 10px 18px; padding:0;">${offices.map((o) => `<li style="margin:2px 0;">${o}</li>`).join("")}</ul></div>`);
    }
    return sections.join("");
}
// Helper to find emails for a list of office names
async function getEmailsForOffices(officeNames) {
    const users = await readUsers();
    const emails = new Set();
    // Normalize helper
    const norm = (s) => s.trim().toLowerCase();
    const targetOffices = new Set(officeNames.map(norm));
    for (const u of users) {
        if (u.email && u.officeName && targetOffices.has(norm(u.officeName))) {
            emails.add(u.email);
        }
    }
    return Array.from(emails);
}
// Helper to get sender email based on creator info
async function getSenderEmail(event) {
    const defaultFrom = process.env.RESEND_FROM_EMAIL || '"DENR Scheduler" <no-reply@denr.gov.ph>';
    return defaultFrom;
}
export async function sendEventCreatedEmail(event) {
    const officeName = event.office || event.createdByOffice;
    const participants = Array.isArray(event.participants) ? event.participants : [];
    // Extract office names from participants list
    // Participants can be "Office Name" or "Person Name — Office Name"
    const involvedOffices = [];
    if (officeName)
        involvedOffices.push(officeName);
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
            }
            else {
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
    const attachments = [];
    const uploadDir = path.join(getDataDir(), "uploads");
    for (const att of Array.isArray(event.attachments) ? event.attachments : []) {
        if (att && typeof att.blob === "string" && att.blob) {
            const parts = att.blob.split(",");
            const data = parts.length >= 2 ? parts.slice(1).join(",") : parts[0];
            attachments.push({
                filename: String(att.name || "attachment"),
                content: data,
            });
            continue;
        }
        if (att && typeof att.url === "string" && att.url.startsWith("/uploads/")) {
            const urlPath = att.url.split("?")[0];
            const diskName = path.basename(urlPath);
            const fullPath = path.join(uploadDir, diskName);
            try {
                if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
                    const fileContent = fs.readFileSync(fullPath).toString("base64");
                    attachments.push({
                        filename: String(att.name || diskName || "attachment"),
                        content: fileContent,
                    });
                }
            }
            catch { }
        }
    }
    const attachmentsHtml = attachments.length
        ? `<p><strong>Attachments:</strong> ${attachments.map((a) => String(a.filename || "attachment")).join(", ")}</p>`
        : "";
    const html = `
    <h2>New Event Scheduled</h2>
    <p><strong>Title:</strong> ${event.title}</p>
    <p><strong>Date:</strong> ${event.dateType === 'range' ? `${formatDate(event.startDate)} to ${formatDate(event.endDate)}` : formatDate(event.date)}</p>
    <p><strong>Time:</strong> ${event.startTime ? `${formatTime(event.startTime)} - ${formatTime(event.endTime)}` : 'All day'}</p>
    <p><strong>Venue:</strong> ${event.location || 'N/A'}</p>
    <p><strong>Participants:</strong><br/>${buildParticipantsHTML(event)}</p>
    <p><strong>Description:</strong><br/>${event.description || 'N/A'}</p>
    <p><strong>Created By:</strong> ${event.createdBy || 'Unknown'} (${event.createdByOffice || 'Unknown'})</p>
    ${attachmentsHtml}
    <br/>
    <p><a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" style="display: inline-block; padding: 10px 20px; background-color: #0A4B39; color: #ffffff; text-decoration: none; border-radius: 5px; font-weight: bold;">View Calendar</a></p>
  `;
    try {
        const { data, error } = await resend.emails.send({
            from: sender,
            to: recipients,
            subject,
            html,
            attachments,
        });
        if (error) {
            console.error("Failed to send event created email:", error);
            return;
        }
        console.log(`Event created email sent to: ${recipients.join(", ")} (ID: ${data?.id})`);
    }
    catch (err) {
        console.error("Failed to send event created email:", err);
    }
}
export async function sendReminderEmail(event, opts) {
    const daysAhead = Number.isFinite(Number(opts?.daysAhead)) ? Number(opts?.daysAhead) : null;
    const hoursAhead = Number.isFinite(Number(opts?.hoursAhead)) ? Number(opts?.hoursAhead) : null;
    const officeName = event.office || event.createdByOffice;
    const participants = Array.isArray(event.participants) ? event.participants : [];
    const involvedOffices = [];
    if (officeName)
        involvedOffices.push(officeName);
    // Ensure the creator's office is always included in the recipients list
    if (event.createdByOffice && !involvedOffices.includes(event.createdByOffice)) {
        involvedOffices.push(event.createdByOffice);
    }
    for (const p of participants) {
        if (typeof p === "string") {
            if (p.includes(" — ")) {
                const parts = p.split(" — ");
                involvedOffices.push(parts[1].trim());
            }
            else {
                involvedOffices.push(p);
            }
        }
    }
    const recipients = await getEmailsForOffices(involvedOffices);
    if (recipients.length === 0)
        return;
    const sender = await getSenderEmail(event);
    const subject = hoursAhead
        ? `Reminder: Event in ${hoursAhead} hour${hoursAhead === 1 ? "" : "s"} - ${event.title}`
        : `Reminder: Upcoming Event - ${event.title}`;
    const leadText = hoursAhead
        ? `coming up in ${hoursAhead} hour${hoursAhead === 1 ? "" : "s"}`
        : `coming up in ${daysAhead === 1 ? "1 day" : "3 days"}`;
    const html = `
    <h2>Event Reminder</h2>
    <p>This is a reminder that the following event is ${leadText}:</p>
    <p><strong>Title:</strong> ${event.title}</p>
    <p><strong>Date:</strong> ${event.dateType === 'range' ? `${formatDate(event.startDate)} to ${formatDate(event.endDate)}` : formatDate(event.date)}</p>
    <p><strong>Time:</strong> ${event.startTime ? `${formatTime(event.startTime)} - ${formatTime(event.endTime)}` : 'All day'}</p>
    <p><strong>Venue:</strong> ${event.location || 'N/A'}</p>
    <br/>
    <p><a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" style="display: inline-block; padding: 10px 20px; background-color: #0A4B39; color: #ffffff; text-decoration: none; border-radius: 5px; font-weight: bold;">View Calendar</a></p>
  `;
    try {
        const { data, error } = await resend.emails.send({
            from: sender,
            to: recipients,
            subject,
            html,
        });
        if (error) {
            console.error("Failed to send reminder email:", error);
            return;
        }
        console.log(`Reminder email sent to: ${recipients.join(", ")} (ID: ${data?.id})`);
    }
    catch (err) {
        console.error("Failed to send reminder email:", err);
    }
}
export async function sendTwoFactorCodeEmail(toEmail, username, code, expiresMinutes) {
    const from = process.env.RESEND_FROM_EMAIL || '"DENR Scheduler" <no-reply@denr.gov.ph>';
    const subject = "Your verification code";
    const html = `
    <h2>Login verification</h2>
    <p>Hello${username ? ` <strong>${username}</strong>` : ""},</p>
    <p>Your verification code is:</p>
    <div style="font-size: 28px; font-weight: 800; letter-spacing: 4px; margin: 12px 0;">${code}</div>
    <p>This code will expire in ${expiresMinutes} minutes.</p>
    <p>If you did not request this, you can ignore this email.</p>
  `;
    const { data, error } = await resend.emails.send({
        from,
        to: toEmail,
        subject,
        html,
    });
    if (error) {
        console.error("Failed to send two-factor email:", error);
        throw error;
    }
}
