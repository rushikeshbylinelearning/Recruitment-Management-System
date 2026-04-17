import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import HRNotesTimeline from './HRNotesTimeline';
import { hrNotesAPI } from '../services/api';

// Mock the API
vi.mock('../services/api', () => ({
  hrNotesAPI: {
    getCandidateHRNotes: vi.fn(),
  },
}));

describe('HRNotesTimeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    vi.mocked(hrNotesAPI.getCandidateHRNotes).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(<HRNotesTimeline candidateId="test-uuid-123" />);
    
    expect(screen.getByText('Loading HR notes...')).toBeInTheDocument();
  });

  it('renders empty state when no notes exist', async () => {
    vi.mocked(hrNotesAPI.getCandidateHRNotes).mockResolvedValue({
      success: true,
      data: { notesByStage: {} },
    });

    render(<HRNotesTimeline candidateId="test-uuid-123" />);
    
    await waitFor(() => {
      expect(screen.getByText('No HR notes yet')).toBeInTheDocument();
    });
  });

  it('renders notes grouped by stage', async () => {
    vi.mocked(hrNotesAPI.getCandidateHRNotes).mockResolvedValue({
      success: true,
      data: {
        notesByStage: {
          Applied: [
            {
              id: 1,
              candidate_id: 'test-uuid-123',
              stage: 'Applied',
              note_text: 'Initial contact made via phone',
              interaction_type: 'Phone Call',
              author_id: 1,
              author_name: 'John Doe',
              author_role: 'Recruiter',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
          Screening: [
            {
              id: 2,
              candidate_id: 'test-uuid-123',
              stage: 'Screening',
              note_text: 'Resume reviewed, moving to interview',
              interaction_type: 'General Note',
              author_id: 1,
              author_name: 'Jane Smith',
              author_role: 'HR Manager',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
        },
      },
    });

    render(<HRNotesTimeline candidateId="test-uuid-123" />);
    
    await waitFor(() => {
      expect(screen.getByText('Applied')).toBeInTheDocument();
      expect(screen.getByText('Screening')).toBeInTheDocument();
      expect(screen.getByText('Initial contact made via phone')).toBeInTheDocument();
      expect(screen.getByText('Resume reviewed, moving to interview')).toBeInTheDocument();
    });
  });

  it('displays interaction type badges correctly', async () => {
    vi.mocked(hrNotesAPI.getCandidateHRNotes).mockResolvedValue({
      success: true,
      data: {
        notesByStage: {
          Applied: [
            {
              id: 1,
              candidate_id: 'test-uuid-123',
              stage: 'Applied',
              note_text: 'Test note',
              interaction_type: 'Email',
              author_id: 1,
              author_name: 'Test User',
              author_role: 'Recruiter',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
        },
      },
    });

    render(<HRNotesTimeline candidateId="test-uuid-123" />);
    
    await waitFor(() => {
      expect(screen.getByText('Email')).toBeInTheDocument();
    });
  });

  it('handles API errors gracefully', async () => {
    vi.mocked(hrNotesAPI.getCandidateHRNotes).mockRejectedValue(
      new Error('Network error')
    );

    render(<HRNotesTimeline candidateId="test-uuid-123" />);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to load HR notes')).toBeInTheDocument();
    });
  });

  it('displays author information', async () => {
    vi.mocked(hrNotesAPI.getCandidateHRNotes).mockResolvedValue({
      success: true,
      data: {
        notesByStage: {
          Applied: [
            {
              id: 1,
              candidate_id: 'test-uuid-123',
              stage: 'Applied',
              note_text: 'Test note',
              interaction_type: 'Phone Call',
              author_id: 1,
              author_name: 'Alice Johnson',
              author_role: 'Senior Recruiter',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
        },
      },
    });

    render(<HRNotesTimeline candidateId="test-uuid-123" />);
    
    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      expect(screen.getByText('(Senior Recruiter)')).toBeInTheDocument();
    });
  });
});
