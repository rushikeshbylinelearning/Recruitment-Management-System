// Resume Parser Utility
// Extracts candidate information from PDF and Word documents

export interface ParsedCandidateData {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  experience?: string;
  skills?: string[];
  expertise?: string;
  expectedSalary?: string;
  currentCtc?: string;
  noticePeriod?: string;
  immediateJoiner?: boolean;
  workPreference?: 'Onsite' | 'WFH' | 'Hybrid';
  willingAlternateSaturday?: boolean;
  notes?: string;
}

export class ResumeParser {
  private text: string = '';

  constructor(text: string) {
    this.text = this.cleanText(text);
  }

  private cleanText(text: string): string {
    // Remove extra whitespace and normalize line breaks
    return text
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .replace(/\t+/g, ' ')
      .trim();
  }

  parse(): ParsedCandidateData {
    const result: ParsedCandidateData = {};

    // Extract basic information
    result.name = this.extractName();
    result.email = this.extractEmail();
    result.phone = this.extractPhone();
    result.location = this.extractLocation();
    result.experience = this.extractExperience();
    result.skills = this.extractSkills();
    result.expertise = this.extractExpertise();
    result.expectedSalary = this.extractExpectedSalary();
    result.currentCtc = this.extractCurrentCtc();
    result.noticePeriod = this.extractNoticePeriod();
    result.immediateJoiner = this.extractImmediateJoiner();
    result.workPreference = this.extractWorkPreference();
    result.willingAlternateSaturday = this.extractWillingAlternateSaturday();
    result.notes = this.extractNotes();

    return result;
  }

  private extractName(): string | undefined {
    // Look for common name patterns at the beginning of the resume
    const lines = this.text.split('\n').slice(0, 10); // Check first 10 lines
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip empty lines or very short lines
      if (trimmed.length < 2 || trimmed.length > 50) continue;
      
      // Skip lines that look like headers or sections
      if (trimmed.match(/^(resume|cv|curriculum vitae|personal information|contact|objective|summary)/i)) continue;
      
      // Skip lines with email or phone patterns
      if (trimmed.includes('@') || trimmed.match(/\d{10,}/)) continue;
      
      // Look for name patterns (2-4 words, mostly letters, may have some punctuation)
      if (trimmed.match(/^[A-Za-z\s\.\-']{2,50}$/) && !trimmed.match(/^\d/)) {
        return trimmed;
      }
    }

    return undefined;
  }

  private extractEmail(): string | undefined {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = this.text.match(emailRegex);
    return matches ? matches[0] : undefined;
  }

  private extractPhone(): string | undefined {
    // Various phone number patterns
    const phonePatterns = [
      /\+?[\d\s\-\(\)]{10,15}/g, // General phone pattern
      /\d{10}/g, // 10 digit number
      /\+91[\s\-]?\d{10}/g, // Indian mobile
      /\+1[\s\-]?\d{3}[\s\-]?\d{3}[\s\-]?\d{4}/g, // US phone
      /\(\d{3}\)[\s\-]?\d{3}[\s\-]?\d{4}/g // US phone with parentheses
    ];

    for (const pattern of phonePatterns) {
      const matches = this.text.match(pattern);
      if (matches) {
        // Return the first valid phone number
        for (const match of matches) {
          const digits = match.replace(/\D/g, '');
          if (digits.length >= 10) {
            return match.trim();
          }
        }
      }
    }

    return undefined;
  }

  private extractLocation(): string | undefined {
    // Look for location patterns
    const locationPatterns = [
      /(?:location|address|based in|from|residing in)[\s:]*([A-Za-z\s,]+)/gi,
      /([A-Za-z\s,]+),\s*(?:India|USA|US|United States|Canada|UK|United Kingdom)/gi,
      /([A-Za-z\s,]+)\s*-\s*(?:India|USA|US|United States|Canada|UK|United Kingdom)/gi
    ];

    for (const pattern of locationPatterns) {
      const match = this.text.match(pattern);
      if (match) {
        return match[1]?.trim();
      }
    }

    // Look for common city names
    const commonCities = [
      'Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Hyderabad', 'Pune', 'Kolkata', 'Ahmedabad',
      'New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia',
      'London', 'Manchester', 'Birmingham', 'Toronto', 'Vancouver', 'Montreal'
    ];

    for (const city of commonCities) {
      // Escape special regex characters in the city name
      const escapedCity = city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedCity}\\b`, 'i');
      if (regex.test(this.text)) {
        return city;
      }
    }

    return undefined;
  }

  private extractExperience(): string | undefined {
    const experiencePatterns = [
      /(?:experience|exp|years? of experience|total experience)[\s:]*([0-9\.\s]+(?:years?|yrs?|months?))/gi,
      /([0-9\.\s]+(?:years?|yrs?|months?))[\s]*(?:of experience|experience)/gi,
      /([0-9\.\s]+(?:years?|yrs?|months?))[\s]+experience/gi
    ];

    for (const pattern of experiencePatterns) {
      const match = this.text.match(pattern);
      if (match) {
        return match[1]?.trim();
      }
    }

    return undefined;
  }

  private extractSkills(): string[] {
    const skills: string[] = [];

    // Common technical skills
    const technicalSkills = [
      'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'PHP', 'Ruby', 'Go', 'Rust',
      'React', 'Angular', 'Vue', 'Node.js', 'Express', 'Django', 'Flask', 'Spring', 'Laravel',
      'HTML', 'CSS', 'SASS', 'SCSS', 'Bootstrap', 'Tailwind', 'jQuery',
      'MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'SQLite', 'Oracle',
      'AWS', 'Azure', 'Google Cloud', 'Docker', 'Kubernetes', 'Jenkins', 'Git',
      'Linux', 'Windows', 'macOS', 'Android', 'iOS', 'React Native', 'Flutter',
      'Machine Learning', 'AI', 'Data Science', 'TensorFlow', 'PyTorch', 'Pandas', 'NumPy'
    ];

    for (const skill of technicalSkills) {
      // Escape special regex characters in the skill name
      const escapedSkill = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedSkill}\\b`, 'i');
      if (regex.test(this.text)) {
        skills.push(skill);
      }
    }

    // Look for skills sections
    const skillsSectionPatterns = [
      /(?:skills?|technical skills?|technologies?|programming languages?)[\s:]*(.*?)(?:\n\n|\n[A-Z]|$)/gi,
      /(?:proficient in|expertise in|familiar with)[\s:]*(.*?)(?:\n\n|\n[A-Z]|$)/gi
    ];

    for (const pattern of skillsSectionPatterns) {
      const match = this.text.match(pattern);
      if (match && match[1]) {
        const skillsText = match[1];
        // Split by common separators and extract skills
        const extractedSkills = skillsText
          .split(/[,;|•\n]/)
          .map(skill => skill.trim())
          .filter(skill => skill.length > 1 && skill.length < 50)
          .slice(0, 10); // Limit to 10 skills
        
        skills.push(...extractedSkills);
      }
    }

    // Remove duplicates and return unique skills
    return [...new Set(skills)].slice(0, 15);
  }

  private extractExpertise(): string | undefined {
    const expertisePatterns = [
      /(?:expertise|specialization|domain|field)[\s:]*([A-Za-z\s,]+)/gi,
      /(?:software engineer|developer|programmer|analyst|manager|designer|architect)/gi
    ];

    for (const pattern of expertisePatterns) {
      const match = this.text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    // Look for job titles or roles
    const jobTitles = [
      'Software Engineer', 'Developer', 'Programmer', 'Full Stack Developer',
      'Frontend Developer', 'Backend Developer', 'DevOps Engineer',
      'Data Scientist', 'Data Analyst', 'Business Analyst',
      'Project Manager', 'Product Manager', 'UI/UX Designer',
      'Mobile Developer', 'QA Engineer', 'System Administrator'
    ];

    for (const title of jobTitles) {
      // Escape special regex characters in the job title
      const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedTitle}\\b`, 'i');
      if (regex.test(this.text)) {
        return title;
      }
    }

    return undefined;
  }

  private extractExpectedSalary(): string | undefined {
    const salaryPatterns = [
      /(?:expected salary|salary expectation|expected ctc|ctc expectation)[\s:]*([0-9,\-\.\s]+(?:lpa|lakh|lacs?|k|thousand|million|cr))/gi,
      /(?:looking for|expecting)[\s:]*([0-9,\-\.\s]+(?:lpa|lakh|lacs?|k|thousand|million|cr))/gi,
      /([0-9,\-\.\s]+(?:lpa|lakh|lacs?|k|thousand|million|cr))[\s]*(?:expected|expecting)/gi
    ];

    for (const pattern of salaryPatterns) {
      const match = this.text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  private extractCurrentCtc(): string | undefined {
    const ctcPatterns = [
      /(?:current salary|current ctc|present salary|current package)[\s:]*([0-9,\-\.\s]+(?:lpa|lakh|lacs?|k|thousand|million|cr))/gi,
      /(?:drawing|earning)[\s:]*([0-9,\-\.\s]+(?:lpa|lakh|lacs?|k|thousand|million|cr))/gi
    ];

    for (const pattern of ctcPatterns) {
      const match = this.text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  private extractNoticePeriod(): string | undefined {
    const noticePatterns = [
      /(?:notice period|notice)[\s:]*([0-9\s]+(?:days?|weeks?|months?))/gi,
      /(?:available in|can join in)[\s:]*([0-9\s]+(?:days?|weeks?|months?))/gi
    ];

    for (const pattern of noticePatterns) {
      const match = this.text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  private extractImmediateJoiner(): boolean | undefined {
    const immediatePatterns = [
      /(?:immediate joiner|can join immediately|available immediately|ready to join)/gi,
      /(?:notice period|notice)[\s:]*0/gi,
      /(?:available in)[\s:]*0/gi
    ];

    for (const pattern of immediatePatterns) {
      if (pattern.test(this.text)) {
        return true;
      }
    }

    return undefined;
  }

  private extractWorkPreference(): 'Onsite' | 'WFH' | 'Hybrid' | undefined {
    const workPatterns = [
      { pattern: /(?:onsite|on-site|office|work from office)/gi, value: 'Onsite' as const },
      { pattern: /(?:work from home|wfh|remote|work remotely)/gi, value: 'WFH' as const },
      { pattern: /(?:hybrid|flexible|both)/gi, value: 'Hybrid' as const }
    ];

    for (const { pattern, value } of workPatterns) {
      if (pattern.test(this.text)) {
        return value;
      }
    }

    return undefined;
  }

  private extractWillingAlternateSaturday(): boolean | undefined {
    const saturdayPatterns = [
      /(?:willing to work|can work|available|okay with)[\s]*(?:on )?alternate saturdays?/gi,
      /(?:alternate saturdays?)[\s]*(?:yes|okay|fine|acceptable)/gi
    ];

    for (const pattern of saturdayPatterns) {
      if (pattern.test(this.text)) {
        return true;
      }
    }

    // Check for negative patterns
    const negativePatterns = [
      /(?:not willing|not available|cannot work)[\s]*(?:on )?alternate saturdays?/gi,
      /(?:alternate saturdays?)[\s]*(?:no|not|unacceptable)/gi
    ];

    for (const pattern of negativePatterns) {
      if (pattern.test(this.text)) {
        return false;
      }
    }

    return undefined;
  }

  private extractNotes(): string | undefined {
    // Extract any additional information that might be useful
    const notePatterns = [
      /(?:objective|summary|about|profile)[\s:]*(.*?)(?:\n\n|\n[A-Z]|$)/gi,
      /(?:achievements?|accomplishments?)[\s:]*(.*?)(?:\n\n|\n[A-Z]|$)/gi
    ];

    const notes: string[] = [];

    for (const pattern of notePatterns) {
      const match = this.text.match(pattern);
      if (match && match[1]) {
        const note = match[1].trim();
        if (note.length > 10 && note.length < 200) {
          notes.push(note);
        }
      }
    }

    return notes.length > 0 ? notes.join('; ') : undefined;
  }
}

// Utility function to extract text from different file types
export async function extractTextFromFile(file: File): Promise<string> {
  try {
    if (file.type === 'text/plain') {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
      });
    } else if (file.type === 'application/pdf') {
      const { PDFTextExtractor } = await import('./pdfTextExtractor');
      return PDFTextExtractor.extractText(file);
    } else if (file.type.includes('word') || file.type.includes('document') || 
               file.name.toLowerCase().endsWith('.docx') || 
               file.name.toLowerCase().endsWith('.doc')) {
      const { WordTextExtractor } = await import('./pdfTextExtractor');
      return WordTextExtractor.extractText(file);
    } else {
      throw new Error('Unsupported file type. Please use PDF, Word, or text files.');
    }
  } catch (error) {
    throw new Error(`Failed to extract text from file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Main parsing function
export async function parseResume(file: File): Promise<ParsedCandidateData> {
  try {
    const text = await extractTextFromFile(file);
    const parser = new ResumeParser(text);
    return parser.parse();
  } catch (error) {
    console.error('Resume parsing error:', error);
    throw error;
  }
}
