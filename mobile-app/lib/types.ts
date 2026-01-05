export enum AvailabilityStatus {
  AVAILABLE = 'AVAILABLE',
  QUESTIONABLE = 'QUESTIONABLE',
  UNAVAILABLE = 'UNAVAILABLE',
}

export interface User {
  id: string;
  name: string | null;
  email: string;
}

export interface Contact extends User {
  status?: ContactStatus;
}

export interface ContactStatus {
  id: string;
  status: AvailabilityStatus;
  message?: string;
  startTime: string;
  endTime: string;
}

export interface CreateStatusInput {
  status: AvailabilityStatus;
  message?: string;
  startTime: string;
  endTime: string;
}

