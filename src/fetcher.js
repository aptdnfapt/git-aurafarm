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

export function calculateTotalStars(repositories) {
  if (!repositories || !repositories.nodes) return 0;
  return repositories.nodes.reduce((acc, repo) => acc + (repo.stargazerCount || 0), 0);
}

export function calculateTotalForks(repositories) {
  if (!repositories || !repositories.nodes) return 0;
  return repositories.nodes.reduce((acc, repo) => acc + (repo.forkCount || 0), 0);
}

export function calculateTopLanguages(repositories) {
  const langSizes = {};
  const langColors = {};

  if (!repositories || !repositories.nodes) return [];

  repositories.nodes.forEach(repo => {
    if (repo.languages && repo.languages.edges) {
      repo.languages.edges.forEach(edge => {
        const langName = edge.node.name;
        const langSize = edge.size;
        const langColor = edge.node.color;

        langSizes[langName] = (langSizes[langName] || 0) + langSize;
        langColors[langName] = langColor;
      });
    }
  });

  const totalSize = Object.values(langSizes).reduce((a, b) => a + b, 0);
  
  const sortedLangs = Object.keys(langSizes)
    .map(name => ({
      name,
      size: langSizes[name],
      color: langColors[name]
    }))
    .sort((a, b) => b.size - a.size);

  const top5 = sortedLangs.slice(0, 5);
  const othersSize = sortedLangs.slice(5).reduce((acc, curr) => acc + curr.size, 0);

  const result = top5.map(lang => ({
    ...lang,
    percent: totalSize > 0 ? (lang.size / totalSize) * 100 : 0
  }));

  if (othersSize > 0) {
    result.push({
      name: "Others",
      size: othersSize,
      color: "#8b949e", // Gray
      percent: totalSize > 0 ? (othersSize / totalSize) * 100 : 0
    });
  }

  return result;
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
        repositories(first: 100, ownerAffiliations: OWNER, orderBy: {field: UPDATED_AT, direction: DESC}) {
          nodes {
            name
            stargazerCount
            forkCount
            languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
              edges {
                size
                node {
                  name
                  color
                }
              }
            }
          }
          totalCount
        }
        issues(first: 10, states: OPEN) {
          totalCount
          nodes {
            title
            number
            repository { name }
          }
        }
        pullRequests(first: 10, states: OPEN) {
          totalCount
          nodes {
            title
            number
            repository { name }
          }
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


export async function getLocalStats() {
  try {
    if (!fs.existsSync('.git')) {
      throw new Error("No .git directory found. Please run this command from the root of a git repository.");
    }

    let name = "Local User";
    let email = "local";

    try {
      const { stdout } = await execa('git', ['config', 'user.name']);
      name = stdout.trim();
    } catch (e) {
      // Ignore error, use default
    }

    try {
      const { stdout } = await execa('git', ['config', 'user.email']);
      email = stdout.trim();
    } catch (e) {
      // Ignore error, use default
    }

    const logArgs = ['log', '--pretty=format:%ai'];
    if (email !== "local") {
      logArgs.push(`--author=${email}`);
    }

    const { stdout: log } = await execa('git', logArgs);

    const commits = log.split('\n').filter(Boolean);
    const commitCounts = {};

    commits.forEach(dateStr => {
      const date = dateStr.split(' ')[0];
      commitCounts[date] = (commitCounts[date] || 0) + 1;
    });

    const weeks = [];
    const today = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(today.getFullYear() - 1);
    oneYearAgo.setDate(oneYearAgo.getDate() - oneYearAgo.getDay());

    let currentDate = new Date(oneYearAgo);

    while (currentDate <= today) {
      const contributionDays = [];
      for (let i = 0; i < 7; i++) {
        const dateString = currentDate.toISOString().split('T')[0];
        const count = commitCounts[dateString] || 0;

        let color = '#ebedf0';
        if (count > 0) color = '#9be9a8';
        if (count > 3) color = '#40c463';
        if (count > 6) color = '#30a14e';
        if (count > 9) color = '#216e39';

        contributionDays.push({
          contributionCount: count,
          date: dateString,
          color
        });
        currentDate.setDate(currentDate.getDate() + 1);
      }
      weeks.push({ contributionDays });
    }

    return {
      user: {
        name: name || "Local User",
        login: email || "local",
        bio: "Local Git Repository",
        followers: { totalCount: 0 },
        repositories: { totalCount: 1 }
      },
      stats: {
        repositories: {
          totalCount: 1,
          nodes: []
        },
        issues: { totalCount: 0, nodes: [] },
        pullRequests: { totalCount: 0, nodes: [] },
        followers: { totalCount: 0 },
        contributionsCollection: {
          contributionCalendar: {
            totalContributions: commits.length,
            weeks
          }
        }
      }
    };
  } catch (e) {
    throw new Error(`Failed to get local stats: ${e.message}`);
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
    if (lastWeek.contributionDays[6 - i]) {
      lastWeek.contributionDays[6 - i].contributionCount = 5;
    }
  }

  return {
    user: {
      name: "Mock User",
      login: "mockuser",
      bio: "Full Stack Developer | Open Source Enthusiast\nLove building CLI tools!",
      followers: { totalCount: 123 },
      repositories: { totalCount: 42 } // In case structure differs
    },
    stats: {
      repositories: {
        totalCount: 42,
        nodes: [
          { name: "repo-a", stargazerCount: 150, forkCount: 20, languages: { edges: [{ size: 5000, node: { name: "JavaScript", color: "#f1e05a" } }] } },
          { name: "repo-b", stargazerCount: 50, forkCount: 5, languages: { edges: [{ size: 2000, node: { name: "JavaScript", color: "#f1e05a" } }] } },
          { name: "repo-c", stargazerCount: 300, forkCount: 45, languages: { edges: [{ size: 8000, node: { name: "Rust", color: "#dea584" } }] } },
          { name: "repo-d", stargazerCount: 10, forkCount: 2, languages: { edges: [{ size: 1000, node: { name: "Python", color: "#3572A5" } }] } },
        ]
      },
      issues: {
        totalCount: 5,
        nodes: [
          { title: "Bug fix", number: 101, repository: { name: "repo-a" } },
          { title: "Feature req", number: 102, repository: { name: "repo-b" } }
        ]
      },
      pullRequests: {
        totalCount: 3,
        nodes: [
          { title: "New feature", number: 201, repository: { name: "repo-a" } }
        ]
      },
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

export async function fetchAllStats(flags = {}) {
  if (flags.mock) return getMockStats();
  if (flags.local) return getLocalStats();

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
