/**
 * Encrypted Storage Module
 * Handles secure storage of face embeddings in IndexedDB with AES-256-GCM encryption
 */

import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'biometric-data';
const DB_VERSION = 1;
const STORE_NAME = 'enrollments';

// Encryption key is derived from device-specific data
// In production, this should use Web Crypto API with user-specific keys
let encryptionKey: CryptoKey | null = null;

export interface EnrollmentData {
    id: string;
    userId: string;
    embedding: Float32Array; // Will be encrypted when stored
    metadata: {
        enrolledAt: Date;
        deviceInfo: string;
        version: string;
        model: string;
        [key: string]: any;
    };
}

export interface StoredEnrollment {
    id: string;
    userId: string;
    encryptedEmbedding: Uint8Array;
    iv: Uint8Array;
    metadata: any;
}

class BiometricStorage {
    private db: IDBPDatabase | null = null;

    /**
     * Initialize storage and encryption
     */
    async initialize(): Promise<void> {
        if (this.db) return;

        // Initialize encryption key
        if (!encryptionKey) {
            await this.initializeEncryption();
        }

        // Open IndexedDB
        this.db = await openDB(DB_NAME, DB_VERSION, {
            upgrade(db) {
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                    store.createIndex('userId', 'userId', { unique: false });
                    store.createIndex('enrolledAt', 'metadata.enrolledAt', { unique: false });
                }
            }
        });

        console.log('[BiometricStorage] Initialized');
    }

    /**
     * Initialize encryption key using Web Crypto API
     */
    private async initializeEncryption(): Promise<void> {
        // In production, derive this from user password or device-specific data
        // For now, generate a random key (will be lost on page refresh)

        // Try to load existing key from secure storage
        const stored Key = await this.loadStoredKey();

        if (storedKey) {
            encryptionKey = storedKey;
        } else {
            // Generate new key
            encryptionKey = await crypto.subtle.generateKey(
                {
                    name: 'AES-GCM',
                    length: 256
                },
                true, // extractable
                ['encrypt', 'decrypt']
            );

            // Store key (in production, this should be more secure)
            await this.storeKey(encryptionKey);
        }

        console.log('[BiometricStorage] Encryption initialized');
    }

    /**
     * Store encryption key in localStorage (NOT SECURE - for demo only)
     */
    private async storeKey(key: CryptoKey): Promise<void> {
        const exported = await crypto.subtle.exportKey('jwk', key);
        localStorage.setItem('biometric-key', JSON.stringify(exported));
    }

    /**
     * Load encryption key from localStorage
     */
    private async loadStoredKey(): Promise<CryptoKey | null> {
        const stored = localStorage.getItem('biometric-key');
        if (!stored) return null;

        try {
            const jwk = JSON.parse(stored);
            return await crypto.subtle.importKey(
                'jwk',
                jwk,
                { name: 'AES-GCM', length: 256 },
                true,
                ['encrypt', 'decrypt']
            );
        } catch (e) {
            console.error('[BiometricStorage] Failed to load stored key:', e);
            return null;
        }
    }

    /**
     * Encrypt embedding
     */
    private async encryptEmbedding(embedding: Float32Array): Promise<{ encrypted: Uint8Array; iv: Uint8Array }> {
        if (!encryptionKey) throw new Error('Encryption not initialized');

        // Generate random IV
        const iv = crypto.getRandomValues(new Uint8Array(12));

        // Convert Float32Array to Uint8Array
        const embeddingBytes = new Uint8Array(embedding.buffer);

        // Encrypt
        const encrypted = await crypto.subtle.encrypt(
            {
                name: 'AES-GCM',
                iv
            },
            encryptionKey,
            embeddingBytes
        );

        return {
            encrypted: new Uint8Array(encrypted),
            iv
        };
    }

    /**
     * Decrypt embedding
     */
    private async decryptEmbedding(encrypted: Uint8Array, iv: Uint8Array): Promise<Float32Array> {
        if (!encryptionKey) throw new Error('Encryption not initialized');

        // Decrypt
        const decrypted = await crypto.subtle.decrypt(
            {
                name: 'AES-GCM',
                iv
            },
            encryptionKey,
            encrypted
        );

        // Convert back to Float32Array
        return new Float32Array(decrypted);
    }

    /**
     * Store an enrollment
     */
    async storeEnrollment(enrollment: EnrollmentData): Promise<void> {
        await this.initialize();

        // Encrypt embedding
        const { encrypted, iv } = await this.encryptEmbedding(enrollment.embedding);

        // Store in IndexedDB
        const stored: StoredEnrollment = {
            id: enrollment.id,
            userId: enrollment.userId,
            encryptedEmbedding: encrypted,
            iv,
            metadata: enrollment.metadata
        };

        await this.db!.put(STORE_NAME, stored);

        console.log(`[BiometricStorage] Enrollment stored: ${enrollment.userId}`);
    }

    /**
     * Get an enrollment by ID
     */
    async getEnrollment(id: string): Promise<EnrollmentData | null> {
        await this.initialize();

        const stored = await this.db!.get(STORE_NAME, id) as StoredEnrollment | undefined;

        if (!stored) return null;

        // Decrypt embedding
        const embedding = await this.decryptEmbedding(stored.encryptedEmbedding, stored.iv);

        return {
            id: stored.id,
            userId: stored.userId,
            embedding,
            metadata: stored.metadata
        };
    }

    /**
     * Get all enrollments for a user
     */
    async getEnrollmentsByUser(userId: string): Promise<EnrollmentData[]> {
        await this.initialize();

        const stored = await this.db!.getAllFromIndex(STORE_NAME, 'userId', userId) as StoredEnrollment[];

        const enrollments: EnrollmentData[] = [];

        for (const item of stored) {
            const embedding = await this.decryptEmbedding(item.encryptedEmbedding, item.iv);
            enrollments.push({
                id: item.id,
                userId: item.userId,
                embedding,
                metadata: item.metadata
            });
        }

        return enrollments;
    }

    /**
     * Get all enrollments
     */
    async getAllEnrollments(): Promise<EnrollmentData[]> {
        await this.initialize();

        const stored = await this.db!.getAll(STORE_NAME) as StoredEnrollment[];

        const enrollments: EnrollmentData[] = [];

        for (const item of stored) {
            const embedding = await this.decryptEmbedding(item.encryptedEmbedding, item.iv);
            enrollments.push({
                id: item.id,
                userId: item.userId,
                embedding,
                metadata: item.metadata
            });
        }

        return enrollments;
    }

    /**
     * Delete an enrollment
     */
    async deleteEnrollment(id: string): Promise<void> {
        await this.initialize();

        await this.db!.delete(STORE_NAME, id);

        console.log(`[BiometricStorage] Enrollment deleted: ${id}`);
    }

    /**
     * Delete all enrollments for a user (GDPR right-to-forget)
     */
    async deleteUserEnrollments(userId: string): Promise<void> {
        await this.initialize();

        const enrollments = await this.getEnrollmentsByUser(userId);

        for (const enrollment of enrollments) {
            await this.deleteEnrollment(enrollment.id);
        }

        console.log(`[BiometricStorage] All enrollments deleted for user: ${userId}`);
    }

    /**
     * Clear all enrollments
     */
    async clearAll(): Promise<void> {
        await this.initialize();

        await this.db!.clear(STORE_NAME);

        console.log('[BiometricStorage] All enrollments cleared');
    }

    /**
     * Get storage statistics
     */
    async getStats(): Promise<{ count: number; users: string[] }> {
        await this.initialize();

        const all = await this.db!.getAll(STORE_NAME) as StoredEnrollment[];

        const users = [...new Set(all.map(e => e.userId))];

        return {
            count: all.length,
            users
        };
    }

    /**
     * Export enrollment (for data portability)
     */
    async exportEnrollment(id: string): Promise<string> {
        const enrollment = await this.getEnrollment(id);

        if (!enrollment) throw new Error(`Enrollment not found: ${id}`);

        // Convert embedding to array for JSON serialization
        const exported = {
            ...enrollment,
            embedding: Array.from(enrollment.embedding)
        };

        return JSON.stringify(exported);
    }

    /**
     * Import enrollment (from exported data)
     */
    async importEnrollment(data: string): Promise<void> {
        const parsed = JSON.parse(data);

        const enrollment: EnrollmentData = {
            ...parsed,
            embedding: new Float32Array(parsed.embedding)
        };

        await this.storeEnrollment(enrollment);
    }
}

// Export singleton
export const biometricStorage = new BiometricStorage();
