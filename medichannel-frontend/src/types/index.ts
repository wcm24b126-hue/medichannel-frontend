export type UserRole = "CUSTOMER" | "DOCTOR" | "MANAGER" | "ADMIN";

export interface User {
  id: number;
  fullName: string;
  email: string;
  role: UserRole;
}

export interface Doctor {
  id: number;
  fullName: string;
  specialisation: string;
  qualifications?: string;
  fee: number;
  bio?: string;
}

export interface Session {
  id: number;
  doctorName: string;
  specialisation: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  sessionType: "PHYSICAL" | "ONLINE";
  roomName?: string;
  fee: number;
  numbersLeft: number;
}

export interface Appointment {
  id: number;
  bookingReference: string;
  appointmentNumber: number;
  doctorName: string;
  sessionDate: string;
  sessionType: "PHYSICAL" | "ONLINE";
  status: string;
  paymentStatus: string;
  estimatedTime?: string;
}
