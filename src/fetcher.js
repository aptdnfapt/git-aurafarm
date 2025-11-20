import fs from 'fs';
import path from 'path';
import os from 'os';
import { execa } from 'execa';

const GITHUB_API_BASE = "https://api.github.com";
const CACHE_DIR = path.join(os.homedir(), '.cache', 'gitfetch-js');
const CACHE_FILE = path.join(CACHE_DIR, 'stats.json');
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function getCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
      const cache = JSON.parse(raw);
      if (Date.now() - cache.timestamp < CACHE_TTL) {
        return cache.data;
      }
    }
  } catch (e) {
    // ignore cache errors
  }
  return null;
}

function setCache(data) {
  try {
    ensureCacheDir();
    fs.writeFileSync(CACHE_FILE, JSON.stringify({
      timestamp: Date.now(),
      data
    }), 'utf-8');
  } catch (e) {
    // ignore cache write errors
  }
}

async function fetchWithToken(endpoint, options = {}) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("No GITHUB_TOKEN");

  const response = await fetch(`${GITHUB_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "gitfetch-js",
      ...options.headers
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API error (${response.status}): ${response.statusText} - ${body}`);
  }

  return response.json();
}

export function calculateStreaks(weeks) {
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;
  
  // Flatten weeks into a single array of days
  const days = weeks.flatMap(w => w.contributionDays);
  
  // Sort by date just in case, though usually they are sorted
  // days.sort((a, b) => new Date(a.date) - new Date(b.date));

  const today = new Date().toISOString().split('T')[0];

  // Iterate days
  for (const day of days) {
    if (day.contributionCount > 0) {
      tempStreak++;
      if (tempStreak > longestStreak) {
        longestStreak = tempStreak;
      }
    } else {
      // If it's not today, reset.
      // If it IS today and 0, we don't reset tempStreak YET because we might contribute later?
      // Standard streak logic usually breaks on 0.
      // GitHub logic: if today is 0, streak is still valid from yesterday.
      if (day.date !== today) {
          tempStreak = 0;
      }
    }
  }

  // Current streak calculation is tricky from forward iteration.
  // Better to go backwards for current streak.
  
  let current = 0;
  // Check from end
  for (let i = days.length - 1; i >= 0; i--) {
      const day = days[i];
      // If it's today and 0, skip/continue to yesterday
      if (day.date === today && day.contributionCount === 0) continue;
      
      if (day.contributionCount > 0) {
          current++;
      } else {
          break;
      }
  }

  return {
      current: current,
      longest: longestStreak
  };
}

export async function getAuthenticatedUser() {
  // Try GITHUB_TOKEN first
  if (process.env.GITHUB_TOKEN) {
    try {
      return await fetchWithToken("/user");
    } catch (e) {
      // If token fails, we want to know why, but maybe still fall back?
      // Actually, if the user EXPLICITLY provided a token, and it fails, we should probably stop and report it,
      // rather than silently falling back to `gh` which might also fail or be confusing.
      // But for now, let's log it clearly.
      console.warn(`\n[Warning] GITHUB_TOKEN failed: ${e.message}\nFalling back to 'gh' CLI...`);
    }
  }

  // Fallback to 'gh' CLI
  try {
    const { stdout } = await execa('gh', ['api', 'user']);
    return JSON.parse(stdout);
  } catch (error) {
    return null;
  }
}

export async function getContributionStats(username) {
  const query = `
    query($userName:String!) {
      user(login: $userName) {
        name
        login
        avatarUrl
        followers { totalCount }
        following { totalCount }
        repositories(first: 1, ownerAffiliations: OWNER, orderBy: {field: UPDATED_AT, direction: DESC}) {
          totalCount
        }
        contributionsCollection {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                contributionCount
                date
                color
              }
            }
          }
        }
      }
    }
  `;

  // Try GITHUB_TOKEN
  if (process.env.GITHUB_TOKEN) {
     return await fetchWithToken("/graphql", {
        method: "POST",
        body: JSON.stringify({
           query,
           variables: { userName: username }
        })
     });
  }

  // Fallback to gh CLI
  try {
    // Use gh api graphql to fetch data
    const { stdout } = await execa('gh', ['api', 'graphql', '-f', `query=${query}`, '-f', `userName=${username}`]);
    return JSON.parse(stdout);
  } catch (error) {
    console.error("Error fetching GraphQL stats:", error.stderr || error.message);
    throw error;
  }
}


export async function getMockStats() {
  // Generate 52 weeks of random data
  const weeks = [];
  const now = new Date();
  for (let w = 0; w < 53; w++) {
    const contributionDays = [];
    for (let d = 0; d < 7; d++) {
        const count = Math.floor(Math.random() * 10);
        // Green shades
        const color = count === 0 ? '#ebedf0' : 
                      count < 3 ? '#9be9a8' : 
                      count < 6 ? '#40c463' : 
                      count < 9 ? '#30a14e' : '#216e39';
        contributionDays.push({
            contributionCount: count,
            date: "2025-01-01",
            color
        });
    }
    weeks.push({ contributionDays });
  }

  // Ensure a streak
  // Set last few days to have contributions
  const lastWeek = weeks[weeks.length - 1];
  for (let i = 0; i < 3; i++) {
      // Make sure we have days
      if (lastWeek.contributionDays[6-i]) {
          lastWeek.contributionDays[6-i].contributionCount = 5;
      }
  }

  return {
    user: {
      name: "Mock User",
      login: "mockuser",
      followers: { totalCount: 123 },
      repositories: { totalCount: 42 } // In case structure differs
    },
    stats: {
      repositories: { totalCount: 42 },
      followers: { totalCount: 123 },
      contributionsCollection: {
        contributionCalendar: {
          totalContributions: 1337,
          weeks
        }
      }
    }
  };
}

export async function fetchAllStats(useMock = false) {
  if (useMock) return getMockStats();

  const cached = getCache();
  if (cached) {
      // Return cached data immediately, assuming it's the same user
      // We could improve this by storing key by user, but for MVP...
      return cached;
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    throw new Error("Please install 'gh' CLI and authenticate with 'gh auth login'");
  }
  
  const stats = await getContributionStats(user.login);
  const result = {
    user: user,
    stats: stats.data.user
  };
  
  setCache(result);
  return result;
}
