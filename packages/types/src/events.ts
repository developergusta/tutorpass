// Contrato único de eventos — API, Web e Mobile importam daqui. Mudar aqui = mudar nos 3.
export const PickupEvents = {
  EntryCreated: 'queue.entry.created',
  EntryCalled: 'queue.entry.called',
  EntryStatusChanged: 'queue.entry.status_changed',
  StudentCalled: 'student.called',
  PickupValidated: 'pickup.validated',
  PickupCompleted: 'pickup.completed',
  PickupBlocked: 'pickup.blocked',
  Snapshot: 'queue.snapshot',
  LocationUpdate: 'tutor.location.update',
} as const;
export interface QueueEntryDto { id: string; studentId: string; studentName: string; classroomId: string; tutorName: string; status: string; joinedAt: string; vehicle?: { plate: string; color?: string } }
