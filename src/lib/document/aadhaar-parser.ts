/**
 * Aadhaar Card Validator with Verhoeff Checksum
 * Production-grade validation for Indian Aadhaar numbers
 * Reference: https://en.wikipedia.org/wiki/Verhoeff_algorithm
 */

export interface AadhaarData {
    number: string;          // Formatted: "XXXX XXXX XXXX"
    numberRaw: string;       // Raw: "XXXXXXXXXXXX"
    name?: string;           // Extracted name
    dob?: string;            // Date of birth
    gender?: string;         // M/F
    address?: string;        // Full address
    isValid: boolean;        // Passes Verhoeff validation
    confidence: number;      // OCR confidence (0-1)
}

export interface ParseResult {
    success: boolean;
    data?: AadhaarData;
    error?: string;
    rawText: string;
}

// Verhoeff algorithm multiplication table
const D_TABLE = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
    [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
    [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
    [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
    [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
    [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
    [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
    [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
];

// Verhoeff algorithm permutation table
const P_TABLE = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
    [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
    [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
    [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
    [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
    [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
];

// Verhoeff algorithm inverse table
const INV_TABLE = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];

class AadhaarParser {
    // Aadhaar number regex: 12 digits, may have spaces
    private readonly AADHAAR_REGEX = /\b\d{4}\s?\d{4}\s?\d{4}\b/g;

    /**
     * Sanitize OCR output - handle common OCR errors
     */
    sanitizeAadhaarString(input: string): string {
        return input
            // Common OCR character substitutions
            .replace(/[OIl|]/gi, (ch) => {
                if (ch === 'O' || ch === 'o') return '0';
                if (ch === 'I' || ch === 'l' || ch === '|') return '1';
                return ch;
            })
            .replace(/S/g, '5')
            .replace(/B/g, '8')
            // Remove all non-digits
            .replace(/\D/g, '');
    }

    /**
     * Validate Aadhaar number using Verhoeff algorithm
     * This is the CORRECT implementation
     */
    verhoeffValidate(numStr: string): boolean {
        const sanitized = this.sanitizeAadhaarString(numStr);
        if (sanitized.length !== 12) return false;

        let c = 0;
        const digits = sanitized.split('').map((d) => parseInt(d, 10)).reverse();

        for (let i = 0; i < digits.length; i++) {
            c = D_TABLE[c][P_TABLE[i % 8][digits[i]]];
        }

        // Valid if and only if checksum value c == 0
        return c === 0;
    }

    /**
     * Parse Aadhaar data from OCR text
     */
    parseFromText(ocrText: string, confidence: number = 1.0): ParseResult {
        try {
            // Extract Aadhaar numbers
            const aadhaarNumbers = this.extractAadhaarNumbers(ocrText);

            if (aadhaarNumbers.length === 0) {
                return {
                    success: false,
                    error: 'No Aadhaar number found in text',
                    rawText: ocrText
                };
            }

            // Validate all found numbers using Verhoeff, pick first valid one
            let validAadhaar: string | null = null;
            for (const num of aadhaarNumbers) {
                if (this.verhoeffValidate(num)) {
                    validAadhaar = num;
                    break;
                }
            }

            if (!validAadhaar) {
                // Return the first candidate for user correction
                const sanitized = this.sanitizeAadhaarString(aadhaarNumbers[0]);
                return {
                    success: false,
                    error: `Invalid Aadhaar checksum. Found: ${this.formatAadhaar(sanitized)}. Please verify and correct.`,
                    rawText: ocrText,
                    data: {
                        number: this.formatAadhaar(sanitized),
                        numberRaw: sanitized,
                        isValid: false,
                        confidence
                    }
                };
            }

            // Extract additional information
            const name = this.extractName(ocrText);
            const dob = this.extractDOB(ocrText);
            const gender = this.extractGender(ocrText);

            const data: AadhaarData = {
                number: this.formatAadhaar(validAadhaar),
                numberRaw: validAadhaar,
                name,
                dob,
                gender,
                isValid: true,
                confidence
            };

            return {
                success: true,
                data,
                rawText: ocrText
            };
        } catch (e) {
            return {
                success: false,
                error: e instanceof Error ? e.message : 'Unknown error',
                rawText: ocrText
            };
        }
    }

    /**
     * Extract Aadhaar numbers from text
     */
    private extractAadhaarNumbers(text: string): string[] {
        const matches = text.match(this.AADHAAR_REGEX);
        if (!matches) return [];

        // Remove spaces and return unique numbers
        return [...new Set(matches.map(m => m.replace(/\s/g, '')))];
    }

    /**
     * Format Aadhaar for display: XXXX XXXX XXXX
     */
    formatAadhaar(aadhaar: string): string {
        const clean = this.sanitizeAadhaarString(aadhaar);
        return clean.replace(/(\d{4})(\d{4})(\d{4})/, '$1 $2 $3');
    }

    /**
     * Mask Aadhaar for privacy: XXXX XXXX 1234
     */
    maskAadhaar(aadhaar: string): string {
        const clean = this.sanitizeAadhaarString(aadhaar);
        return clean.replace(/(\d{4})(\d{4})(\d{4})/, 'XXXX XXXX $3');
    }

    /**
     * Extract name from Aadhaar card text
     */
    private extractName(text: string): string | undefined {
        const namePatterns = [
            /Name[:\s]+([A-Z][A-Z\s]+)/i,
            /नाम[:\s]+([A-Z][A-Z\s]+)/i,  // Hindi
            /([A-Z][A-Z\s]{5,})/  // Fallback: capitals only
        ];

        for (const pattern of namePatterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                const name = match[1].trim();
                if (!this.isCommonWord(name) && name.length >= 3) {
                    return name;
                }
            }
        }

        return undefined;
    }

    /**
     * Extract date of birth from text
     */
    private extractDOB(text: string): string | undefined {
        const dobPatterns = [
            /DOB[:\s]+(\d{2}\/\d{2}\/\d{4})/i,
            /Birth[:\s]+(\d{2}\/\d{2}\/\d{4})/i,
            /जन्म[:\s]+(\d{2}\/\d{2}\/\d{4})/i,  // Hindi
            /(\d{2}\/\d{2}\/\d{4})/  // Fallback
        ];

        for (const pattern of dobPatterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }

        return undefined;
    }

    /**
     * Extract gender from text
     */
    private extractGender(text: string): string | undefined {
        const genderPatterns = [
            /Gender[:\s]+(Male|Female|M|F)/i,
            /Sex[:\s]+(Male|Female|M|F)/i,
            /लिंग[:\s]+(Male|Female|पुरुष|महिला)/i,  // Hindi
            /\b(Male|Female)\b/i
        ];

        for (const pattern of genderPatterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                const gender = match[1].toUpperCase();
                return gender === 'MALE' || gender === 'पुरुष' ? 'M' : 'F';
            }
        }

        return undefined;
    }

    /**
     * Check if word is a common false positive
     */
    private isCommonWord(word: string): boolean {
        const common = [
            'GOVERNMENT', 'INDIA', 'AADHAAR', 'CARD', 'NUMBER',
            'NAME', 'DOB', 'GENDER', 'ADDRESS', 'UID', 'UIDAI'
        ];
        return common.includes(word.toUpperCase());
    }

    /**
     * Validate extracted data quality
     */
    validateData(data: AadhaarData): { valid: boolean; issues: string[] } {
        const issues: string[] = [];

        // Check Aadhaar number with Verhoeff
        if (!this.verhoeffValidate(data.numberRaw)) {
            issues.push('Invalid Aadhaar checksum (Verhoeff validation failed)');
        }

        // Check name quality
        if (data.name && data.name.length < 3) {
            issues.push('Name too short');
        }

        // Check DOB format
        if (data.dob && !/^\d{2}\/\d{2}\/\d{4}$/.test(data.dob)) {
            issues.push('Invalid DOB format');
        }

        // Check confidence
        if (data.confidence < 0.7) {
            issues.push('Low OCR confidence');
        }

        return {
            valid: issues.length === 0,
            issues
        };
    }
}

// Export singleton
export const aadhaarParser = new AadhaarParser();

// Export functions for standalone use
export function verhoeffValidate(numStr: string): boolean {
    return aadhaarParser.verhoeffValidate(numStr);
}

export function sanitizeAadhaarString(input: string): string {
    return aadhaarParser.sanitizeAadhaarString(input);
}
