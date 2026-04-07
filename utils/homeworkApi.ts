import Constants from 'expo-constants';

const SUPABASE_URL: string = Constants.expoConfig?.extra?.supabaseUrl ?? '';
const HOMEWORK_BASE = `${SUPABASE_URL}/functions/v1/homework`;

export interface HomeworkAssignment {
  id: string;
  coach_id: string;
  client_id: string;
  subject: string;
  message: string;
  deadline: string | null;
  status: string;
  created_at: string;
  file_count?: number;
}

export interface HomeworkFile {
  id: string;
  filename: string;
  mime: string;
  size: number;
  bucket_path: string;
  created_at: string;
}

export async function createAssignment(
  token: string,
  payload: {
    client_id: string;
    subject: string;
    message: string;
    deadline: string | null;
  }
): Promise<HomeworkAssignment> {
  console.log('[HomeworkAPI] createAssignment — client_id:', payload.client_id, 'subject:', payload.subject);
  const response = await fetch(`${HOMEWORK_BASE}/assignments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('[HomeworkAPI] createAssignment error:', response.status, text);
    throw new Error(`Fout bij aanmaken huiswerk: ${response.status}`);
  }

  const data = await response.json();
  console.log('[HomeworkAPI] createAssignment success:', data?.id);
  return data;
}

export async function listAssignments(
  token: string,
  clientId: string
): Promise<HomeworkAssignment[]> {
  console.log('[HomeworkAPI] listAssignments — client_id:', clientId);
  const response = await fetch(`${HOMEWORK_BASE}/assignments?client_id=${clientId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('[HomeworkAPI] listAssignments error:', response.status, text);
    throw new Error(`Fout bij ophalen huiswerk: ${response.status}`);
  }

  const data = await response.json();
  console.log('[HomeworkAPI] listAssignments success — count:', Array.isArray(data) ? data.length : 0);
  return Array.isArray(data) ? data : [];
}

export async function uploadAssignmentFile(
  token: string,
  assignmentId: string,
  file: { uri: string; name: string; type: string }
): Promise<HomeworkFile> {
  console.log('[HomeworkAPI] uploadAssignmentFile — assignmentId:', assignmentId, 'file:', file.name);
  const formData = new FormData();
  formData.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.type,
  } as unknown as Blob);

  const response = await fetch(`${HOMEWORK_BASE}/assignments/${assignmentId}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('[HomeworkAPI] uploadAssignmentFile error:', response.status, text);
    throw new Error(`Fout bij uploaden bijlage: ${response.status}`);
  }

  const data = await response.json();
  console.log('[HomeworkAPI] uploadAssignmentFile success:', data?.id);
  return data;
}

export async function deleteAssignmentFile(
  token: string,
  assignmentId: string,
  fileId: string
): Promise<void> {
  console.log('[HomeworkAPI] deleteAssignmentFile — assignmentId:', assignmentId, 'fileId:', fileId);
  const response = await fetch(`${HOMEWORK_BASE}/assignments/${assignmentId}/files/${fileId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('[HomeworkAPI] deleteAssignmentFile error:', response.status, text);
    throw new Error(`Fout bij verwijderen bijlage: ${response.status}`);
  }

  console.log('[HomeworkAPI] deleteAssignmentFile success');
}
