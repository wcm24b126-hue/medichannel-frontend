/**
 * Complete End-to-End Verification of Dr. Kamal Hassan Flow & WebSocket Chat:
 * 1. Admin login
 * 2. Create Dr. Kamal Hassan with password "password@123"
 * 3. Activate Dr. Kamal Hassan
 * 4. Doctor login
 * 5. Create an ONLINE session for Dr. Kamal Hassan & Open it
 * 6. Register & login patient, create patient profile
 * 7. Patient books appointment for Dr. Kamal Hassan's online session
 * 8. Patient pays for the appointment (status -> PAID)
 * 9. Doctor starts consultation (status -> IN_CONSULTATION)
 * 10. Two tabs / WebSocket clients connect over STOMP (Patient & Doctor)
 * 11. Real-time chat & typing exchange across the two tabs
 * 12. Security & RBAC tests (IDOR, role restriction, DB ciphertext inspection)
 * 13. Doctor completes consultation (status -> COMPLETED)
 * 14. Read-only chat verification after consultation end (BR-09)
 * 15. Doctor writes consultation summary & prescription
 * 16. Patient reads consultation summary
 * 17. Patient leaves 5-star review for Dr. Kamal Hassan
 * 18. Public doctor review summary verification
 */
import { Client } from "@stomp/stompjs";
import { execSync } from "node:child_process";

const API_BASE = "http://localhost:8080/api/v1";
const WS_URL = "ws://localhost:8080/ws";

const testResults = [];

function recordTest(id, name, ok, details = "") {
  testResults.push({ id, name, ok, details });
  console.log(`${ok ? "[PASS]" : "[FAIL]"} [${id}] ${name} ${details ? "- " + details : ""}`);
}

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const res = await fetch(url, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, ok: res.ok, body: json };
}

async function main() {
  console.log("==================================================================");
  console.log("MEDICHANNEL: DR. KAMAL HASSAN E2E ONLINE CONSULTATION & SECURITY SUITE");
  console.log("==================================================================\n");

  const ts = Date.now();

  // 1. Admin Login
  const adminLogin = await request("/auth/login", {
    method: "POST",
    body: { email: "admin@medichannel.demo", password: "Admin@123456" }
  });
  recordTest("SEC-01", "Admin login with environment credentials", adminLogin.status === 200);
  const adminToken = adminLogin.body.accessToken;

  // 2. Fetch specialisations
  const specsRes = await request("/specialisations");
  const specialisationId = specsRes.body[0].id;

  // 3. Admin creates Dr. Kamal Hassan
  const doctorEmail = `kamal.hassan.${ts}@medichannel.demo`;
  const doctorPassword = "password@123";
  const doctorReg = `SLMC-${ts % 100000}`;

  const createDocRes = await request("/doctors", {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: {
      email: doctorEmail,
      initialPassword: doctorPassword,
      confirmPassword: doctorPassword,
      firstName: "Kamal",
      lastName: "Hassan",
      registrationNumber: doctorReg,
      qualification: "MBBS, MD (Cardiology)",
      specialisationId,
      consultationFee: 3500.00
    }
  });
  recordTest("DOC-01", "Admin creates doctor Kamal Hassan (password@123)", createDocRes.status === 201, `Doctor ID: ${createDocRes.body?.doctorId}`);
  const doctorId = createDocRes.body.doctorId;
  const doctorUserId = createDocRes.body.userId;

  // 4. Admin activates Dr. Kamal Hassan's account
  const activateRes = await request(`/admin/users/${doctorUserId}/activate`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  recordTest("DOC-02", "Admin activates Dr. Kamal Hassan account", activateRes.status === 200 && activateRes.body.accountStatus === "ACTIVE");

  // 5. Dr. Kamal Hassan logs in
  const docLogin = await request("/auth/login", {
    method: "POST",
    body: { email: doctorEmail, password: doctorPassword }
  });
  recordTest("DOC-03", "Dr. Kamal Hassan logs in successfully with new credentials", docLogin.status === 200 && docLogin.body.role === "DOCTOR");
  const doctorToken = docLogin.body.accessToken;

  // 6. Create ONLINE Session for Dr. Kamal Hassan
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
  const createSessionRes = await request("/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: {
      doctorId,
      roomId: null, // Online session does not require a physical room (BR-01)
      sessionDate: tomorrow,
      startTime: "10:00:00",
      endTime: "13:00:00",
      consultationType: "ONLINE",
      maxAppointments: 10,
      minutesPerPatient: 15,
      feeLkr: 3500.00
    }
  });
  recordTest("BR-01", "Create ONLINE session for Dr. Kamal Hassan (no room needed)", createSessionRes.status === 201);
  const sessionId = createSessionRes.body.sessionId;

  // Open session
  const openSessionRes = await request(`/sessions/${sessionId}/open`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  recordTest("SES-01", "Open doctor session for public booking", openSessionRes.status === 200 && openSessionRes.body.status === "OPEN");

  // 7. Register & Login Patient
  const patientEmail = `patient_kamal_${ts}@medichannel.demo`;
  const patientPassword = "PatientSecure#2026!";
  const regPatientRes = await request("/auth/register", {
    method: "POST",
    body: { email: patientEmail, password: patientPassword, confirmPassword: patientPassword }
  });
  recordTest("PAT-01", "Register patient user account", regPatientRes.status === 201);

  const patientLogin = await request("/auth/login", {
    method: "POST",
    body: { email: patientEmail, password: patientPassword }
  });
  recordTest("PAT-02", "Patient login returns CUSTOMER role", patientLogin.status === 200 && patientLogin.body.role === "CUSTOMER");
  const patientToken = patientLogin.body.accessToken;

  // Patient profile creation
  const patientNic = `${(ts + 500) % 1000000000}V`;
  const profileRes = await request("/patients/me", {
    method: "POST",
    headers: { Authorization: `Bearer ${patientToken}` },
    body: {
      firstName: "Anura",
      lastName: "Bandara",
      phone: "0771239999",
      nic: patientNic,
      dateOfBirth: "1988-10-25",
      gender: "MALE"
    }
  });
  recordTest("BR-10", "Create patient profile with valid NIC & phone", profileRes.status === 201);

  // 8. Patient Books Appointment for Dr. Kamal Hassan's Session
  const bookingRes = await request("/appointments", {
    method: "POST",
    headers: { Authorization: `Bearer ${patientToken}` },
    body: {
      sessionId,
      reason: "Experiencing shortness of breath and chest pressure after exertion."
    }
  });
  recordTest("BR-03", "Patient books appointment with Dr. Kamal Hassan", bookingRes.status === 201 && bookingRes.body.appointmentNumber === 1);
  const appointmentId = bookingRes.body.appointmentId;

  // Online appointment starts in BOOKED status (BR-08)
  recordTest("BR-08", "Online appointment starts in BOOKED status (skips reception ARRIVED)", bookingRes.body.status === "BOOKED" && bookingRes.body.consultationType === "ONLINE");

  // 9. Patient Pays for Appointment (Required before consultation can start)
  const payRes = await request(`/appointments/${appointmentId}/payments`, {
    method: "POST",
    headers: { Authorization: `Bearer ${patientToken}` },
    body: { method: "CARD" }
  });
  recordTest("PAY-01", "Patient pays for online consultation appointment", payRes.status === 201 && payRes.body.status === "COMPLETED");

  // 10. Doctor Starts the Online Consultation
  const startConsultRes = await request(`/doctor/appointments/${appointmentId}/start`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${doctorToken}` }
  });
  recordTest("BR-09", "Doctor starts consultation: status -> IN_CONSULTATION", startConsultRes.status === 200 && startConsultRes.body.status === "IN_CONSULTATION");

  // 11. Generate WebSocket Tickets for Patient & Doctor
  const patientTicketRes = await request("/auth/ws-ticket", {
    method: "POST",
    headers: { Authorization: `Bearer ${patientToken}` }
  });
  const doctorTicketRes = await request("/auth/ws-ticket", {
    method: "POST",
    headers: { Authorization: `Bearer ${doctorToken}` }
  });
  recordTest("WS-01", "Short-lived WS ticket issued for Patient", patientTicketRes.status === 200 && Boolean(patientTicketRes.body.ticket));
  recordTest("WS-02", "Short-lived WS ticket issued for Doctor", doctorTicketRes.status === 200 && Boolean(doctorTicketRes.body.ticket));

  const patientTicket = patientTicketRes.body.ticket;
  const doctorTicket = doctorTicketRes.body.ticket;

  // 12. Connect Two STOMP Clients (Simulating Two Browser Tabs)
  console.log("\nEstablishing WebSocket / STOMP connections for Patient and Doctor tabs...");

  let patientReceivedDoctorMsg = null;
  let doctorReceivedPatientMsg = null;
  let patientReceivedTyping = null;

  const chatTopic = `/topic/appointments/${appointmentId}/chat`;
  const typingTopic = `/topic/appointments/${appointmentId}/typing`;
  const chatSendDest = `/app/appointments/${appointmentId}/chat`;
  const typingSendDest = `/app/appointments/${appointmentId}/typing`;

  // Patient Tab Client
  const patientClient = new Client({
    brokerURL: WS_URL,
    connectHeaders: { Authorization: `Bearer ${patientTicket}` },
    debug: () => {},
    reconnectDelay: 0,
  });

  // Doctor Tab Client
  const doctorClient = new Client({
    brokerURL: WS_URL,
    connectHeaders: { Authorization: `Bearer ${doctorTicket}` },
    debug: () => {},
    reconnectDelay: 0,
  });

  await new Promise((resolve, reject) => {
    let patientReady = false;
    let doctorReady = false;

    function checkReady() {
      if (patientReady && doctorReady) resolve();
    }

    patientClient.onConnect = () => {
      patientReady = true;
      patientClient.subscribe(chatTopic, (message) => {
        const body = JSON.parse(message.body);
        if (body.senderRole === "DOCTOR") {
          patientReceivedDoctorMsg = body;
        }
      });
      patientClient.subscribe(typingTopic, (message) => {
        patientReceivedTyping = JSON.parse(message.body);
      });
      checkReady();
    };

    doctorClient.onConnect = () => {
      doctorReady = true;
      doctorClient.subscribe(chatTopic, (message) => {
        const body = JSON.parse(message.body);
        if (body.senderRole === "CUSTOMER" || body.senderRole === "PATIENT") {
          doctorReceivedPatientMsg = body;
        }
      });
      checkReady();
    };

    patientClient.onStompError = (frame) => reject(new Error("Patient STOMP error: " + frame.headers["message"]));
    doctorClient.onStompError = (frame) => reject(new Error("Doctor STOMP error: " + frame.headers["message"]));

    patientClient.activate();
    doctorClient.activate();
  });

  recordTest("WS-03", "Two tabs (Patient & Doctor) successfully connected over WebSocket STOMP", true);

  // 13. Patient sends chat message to Dr. Kamal Hassan
  console.log("Patient sending message to Dr. Kamal Hassan...");
  patientClient.publish({
    destination: chatSendDest,
    body: JSON.stringify({ content: "Hello Dr. Kamal Hassan, I am experiencing intermittent chest discomfort." })
  });

  // Wait for Doctor to receive it
  await new Promise((r) => setTimeout(r, 800));
  recordTest(
    "RT-03",
    "Doctor tab receives Patient's message via WebSocket in real time",
    doctorReceivedPatientMsg !== null && doctorReceivedPatientMsg.content.includes("chest discomfort"),
    doctorReceivedPatientMsg ? `Doctor saw: "${doctorReceivedPatientMsg.content}"` : "None"
  );

  // 14. Doctor sends typing indicator
  console.log("Doctor sending typing indicator...");
  doctorClient.publish({
    destination: typingSendDest,
    body: JSON.stringify({ typing: true })
  });

  await new Promise((r) => setTimeout(r, 500));
  recordTest(
    "RT-03B",
    "Patient tab receives Doctor's typing indicator via WebSocket",
    patientReceivedTyping !== null && patientReceivedTyping.typing === true,
    patientReceivedTyping ? `Typing by: ${patientReceivedTyping.senderName}` : "None"
  );

  // 15. Doctor replies to Patient
  console.log("Dr. Kamal Hassan replying to Patient...");
  doctorClient.publish({
    destination: chatSendDest,
    body: JSON.stringify({ content: "Hello Anura, how long does the pain last, and does it radiate to your left arm?" })
  });

  await new Promise((r) => setTimeout(r, 800));
  recordTest(
    "RT-03C",
    "Patient tab receives Doctor's reply via WebSocket in real time",
    patientReceivedDoctorMsg !== null && patientReceivedDoctorMsg.content.includes("left arm"),
    patientReceivedDoctorMsg ? `Patient saw: "${patientReceivedDoctorMsg.content}"` : "None"
  );

  // 16. Security & Vulnerability Tests
  console.log("\nRunning Security, RBAC & Vulnerability checks...");

  // Sec Test 1: Verify clinical reason is encrypted at rest in PostgreSQL
  try {
    const rawSql = execSync(
      `docker exec medichannel-v4-test psql -U postgres -d medichannel_demo -t -A -c "SELECT reason_encrypted FROM appointments WHERE id = '${appointmentId}';"`,
      { encoding: "utf-8" }
    ).trim();
    const isEncrypted = !rawSql.includes("chest pressure") && (rawSql.startsWith("v1:") || rawSql.length > 30);
    recordTest("SEC-03", "Clinical reason for visit encrypted at rest in database (AES-256-GCM)", isEncrypted, `Ciphertext sample: ${rawSql.slice(0, 25)}...`);
  } catch (err) {
    recordTest("SEC-03", "Clinical reason encrypted at rest in database", false, err.message);
  }

  // Sec Test 2: Unrelated patient cannot access this chat history (IDOR defense)
  const otherPatientEmail = `other_patient_${ts}@medichannel.demo`;
  await request("/auth/register", { method: "POST", body: { email: otherPatientEmail, password: "Pass#12345678", confirmPassword: "Pass#12345678" } });
  const otherLogin = await request("/auth/login", { method: "POST", body: { email: otherPatientEmail, password: "Pass#12345678" } });
  const otherToken = otherLogin.body.accessToken;

  const idorChatRes = await request(`/appointments/${appointmentId}/chat/messages`, {
    headers: { Authorization: `Bearer ${otherToken}` }
  });
  recordTest("SEC-04", "Unrelated patient blocked from chat history (IDOR defense)", [401, 403].includes(idorChatRes.status));

  // Sec Test 3: Admin cannot read consultation chat messages (Privacy Rule)
  const adminChatRes = await request(`/appointments/${appointmentId}/chat/messages`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  recordTest("SEC-05", "Admin cannot read consultation chat messages (Privacy Rule)", [401, 403].includes(adminChatRes.status));

  // 17. Doctor completes consultation
  const completeRes = await request(`/doctor/appointments/${appointmentId}/complete`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${doctorToken}` }
  });
  recordTest("BR-08B", "Doctor marks consultation COMPLETED", completeRes.status === 200 && completeRes.body.status === "COMPLETED");

  // 18. BR-09: Chat becomes read-only when ended
  let lateMsgReceived = false;
  patientClient.subscribe(chatTopic, () => { lateMsgReceived = true; });
  patientClient.publish({ destination: chatSendDest, body: JSON.stringify({ content: "Can I still send messages?" }) });
  await new Promise((r) => setTimeout(r, 600));
  recordTest("BR-09B", "Chat becomes read-only after consultation ends (BR-09)", !lateMsgReceived);

  // Disconnect WebSocket clients
  patientClient.deactivate();
  doctorClient.deactivate();

  // 19. Doctor writes Consultation Summary
  const summaryRes = await request(`/appointments/${appointmentId}/summary`, {
    method: "POST",
    headers: { Authorization: `Bearer ${doctorToken}` },
    body: {
      symptoms: "Exertional chest discomfort and mild dyspnoea.",
      diagnosis: "Suspected stable angina pectoris. Requires ECG and stress test.",
      treatmentNotes: "Rest advised; avoid sudden heavy physical exertion.",
      prescription: "Tab. Glyceryl Trinitrate 0.5mg sublingual as needed for chest pain; Tab. Aspirin 75mg daily.",
      followUpInstructions: "Report to Lanka Care Hospital Cardiology clinic for ECG within 48 hours.",
      followUpDate: tomorrow
    }
  });
  recordTest("DOC-04", "Doctor writes consultation summary & prescription", summaryRes.status === 201);

  // 20. Patient reads consultation summary
  const patientReadSummary = await request(`/appointments/${appointmentId}/summary`, {
    headers: { Authorization: `Bearer ${patientToken}` }
  });
  recordTest("PAT-03", "Patient can read own consultation summary & prescription", patientReadSummary.status === 200 && patientReadSummary.body.diagnosis.includes("angina"));

  // 21. Verify Diagnosis & Prescription are encrypted at rest in DB
  try {
    const rawDiag = execSync(
      `docker exec medichannel-v4-test psql -U postgres -d medichannel_demo -t -A -c "SELECT diagnosis_encrypted FROM consultation_summaries WHERE appointment_id = '${appointmentId}';"`,
      { encoding: "utf-8" }
    ).trim();
    const isDiagEnc = !rawDiag.includes("angina") && (rawDiag.startsWith("v1:") || rawDiag.length > 30);
    recordTest("SEC-06", "Consultation diagnosis encrypted at rest in database (AES-256-GCM)", isDiagEnc, `Ciphertext sample: ${rawDiag.slice(0, 25)}...`);
  } catch (err) {
    recordTest("SEC-06", "Consultation diagnosis encrypted at rest", false, err.message);
  }

  // 22. Patient leaves review for Dr. Kamal Hassan
  const reviewRes = await request(`/appointments/${appointmentId}/review`, {
    method: "POST",
    headers: { Authorization: `Bearer ${patientToken}` },
    body: {
      rating: 5,
      comment: "Dr. Kamal Hassan provided prompt, reassuring advice and clear prescription during online consultation."
    }
  });
  recordTest("REV-01", "Patient leaves 5-star review for Dr. Kamal Hassan", reviewRes.status === 201);

  // 23. Public doctor reviews
  const publicReviews = await request(`/doctors/${doctorId}/reviews`);
  recordTest("REV-02", "Public review aggregate updated for Dr. Kamal Hassan", publicReviews.status === 200 && publicReviews.body.reviewCount >= 1);

  console.log("\n==================================================================");
  console.log("FINAL TEST SUMMARY:");
  const passed = testResults.filter(t => t.ok).length;
  const failed = testResults.filter(t => !t.ok).length;
  console.log(`Total: ${testResults.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log("==================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Test execution aborted:", err);
  process.exit(1);
});
