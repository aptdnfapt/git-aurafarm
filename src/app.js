import React, { useState, useEffect } from 'react';
import { Box, Text, useStdout, useInput, useApp } from 'ink';
import { fetchAllStats, calculateStreaks, calculateTopLanguages, calculateTotalStars, calculateTotalForks } from './fetcher.js';
import { themes } from './themes.js';

const InputHandler = ({ toggleTheme }) => {
  const { exit } = useApp();
  useInput((input, key) => {
    if (input === 'q' || key.escape) {
      exit();
    }
    if (input === 't') {
      toggleTheme();
    }
  });
  return null;
};

// --- UI Components ---

const Label = ({ children }) => <Text color="gray">{children}</Text>;
const Value = ({ children, theme }) => <Text bold color={theme.text}>{children}</Text>;

const MonthHeader = ({ weeks }) => {
  const elements = [];
  let skipNext = false;

  weeks.forEach((week, i) => {
    if (skipNext) {
      skipNext = false;
      return;
    }

    const date = new Date(week.contributionDays[0].date);
    const month = date.getMonth();
    const prevDate = i > 0 ? new Date(weeks[i - 1].contributionDays[0].date) : null;
    const prevMonth = prevDate ? prevDate.getMonth() : -1;

    if (month !== prevMonth) {
      const monthName = date.toLocaleString('default', { month: 'short' });
      // "Jan " is 4 chars. Each week column is 2 chars ("■ ").
      // So "Jan " takes up exactly 2 weeks of space.
      elements.push(<Text key={i} color="gray">{monthName} </Text>);
      skipNext = true;
    } else {
      elements.push(<Text key={i}>  </Text>);
    }
  });

  return (
    <Box flexDirection="row" marginBottom={0}>
      {elements}
    </Box>
  );
};

const Calendar = ({ weeks, theme }) => {
  const { stdout } = useStdout();
  const [columns, setColumns] = useState(stdout.columns || 80);

  useEffect(() => {
    const onResize = () => setColumns(stdout.columns);
    stdout.on('resize', onResize);
    return () => stdout.off('resize', onResize);
  }, [stdout]);

  // Full width minus padding
  const availableWidth = columns - 4; 
  const maxWeeks = Math.max(10, Math.floor(availableWidth / 2));
  const visibleWeeks = weeks.slice(-maxWeeks);

  const rows = [];
  for (let day = 0; day < 7; day++) {
    const rowCells = visibleWeeks.map((week, index) => {
      const dayData = week.contributionDays[day];
      if (!dayData) return <Text key={`cell-${index}`}>  </Text>;

      const count = dayData.contributionCount;
      let level = 0;
      if (count > 0) level = 1;
      if (count > 3) level = 2;
      if (count > 6) level = 3;
      if (count > 9) level = 4;

      return (
        <Text key={`cell-${index}`} color={theme.levels[level]}>■ </Text>
      );
    });
    rows.push(<Box key={`row-${day}`} flexDirection="row">{rowCells}</Box>);
  }

  return (
    <Box flexDirection="column" marginBottom={1}>
      <MonthHeader weeks={visibleWeeks} />
      {rows}
    </Box>
  );
};

const StatRow = ({ label, value, theme }) => (
  <Box flexDirection="row" justifyContent="space-between" width={30} marginRight={4}>
    <Label>{label}</Label>
    <Value theme={theme}>{value}</Value>
  </Box>
);

const Stats = ({ user, stats, theme }) => {
  const stars = calculateTotalStars(stats.repositories);
  const forks = calculateTotalForks(stats.repositories);
  const streaks = calculateStreaks(stats.contributionsCollection.contributionCalendar.weeks);
  const total = stats.contributionsCollection.contributionCalendar.totalContributions;

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box marginBottom={1}><Text bold color={theme.title} underline>STATS</Text></Box>
      <Box flexDirection="row" flexWrap="wrap">
        <Box flexDirection="column">
          <StatRow label="Repositories" value={stats.repositories.totalCount} theme={theme} />
          <StatRow label="Followers" value={user.followers?.totalCount || "-"} theme={theme} />
          <StatRow label="Streak" value={`${streaks.current} days`} theme={theme} />
        </Box>
        <Box flexDirection="column">
          <StatRow label="Total Stars" value={stars} theme={theme} />
          <StatRow label="Total Forks" value={forks} theme={theme} />
          <StatRow label="Total Contribs" value={total} theme={theme} />
        </Box>
      </Box>
    </Box>
  );
};

const ProgressBar = ({ percent, color, width }) => {
  const filled = Math.min(width, Math.max(0, Math.round((percent / 100) * width)));
  const empty = width - filled;
  return (
    <Text>
      <Text color={color}>{"█".repeat(filled)}</Text>
      <Text color="gray" dimColor>{"░".repeat(empty)}</Text>
    </Text>
  );
};

const Languages = ({ stats, theme }) => {
  const topLangs = calculateTopLanguages(stats.repositories);

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box marginBottom={1}><Text bold color={theme.title} underline>LANGUAGES</Text></Box>
      {topLangs.length === 0 ? (
         <Text color="gray" italic>No languages found</Text>
      ) : (
        topLangs.map(lang => (
          <Box key={lang.name} flexDirection="row" marginBottom={0}>
            <Box width={12}><Text color={theme.text} wrap="truncate-end">{lang.name}</Text></Box>
            <Box marginRight={2}><ProgressBar percent={lang.percent} color={lang.color || "white"} width={20} /></Box>
            <Text color={theme.text}>{Math.round(lang.percent)}%</Text>
          </Box>
        ))
      )}
    </Box>
  );
};

const App = ({ flags }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [themeIndex, setThemeIndex] = useState(0);

  const toggleTheme = () => {
    setThemeIndex((prev) => (prev + 1) % themes.length);
  };

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetchAllStats(flags);
        setData(res);
      } catch (e) {
        setError(e.message);
      }
    };
    load();
  }, [flags]);

  if (error) return <Text color="red">Error: {error}</Text>;
  if (!data) return <Text>Loading stats...</Text>;

  const currentTheme = themes[themeIndex];

  return (
    <Box flexDirection="column" padding={1}>
      {process.stdin.isTTY && <InputHandler toggleTheme={toggleTheme} />}

      {/* Header */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color={currentTheme.title}>{data.user.name || data.user.login} <Text color="gray">(@{data.user.login})</Text></Text>
        {data.user.bio && <Text italic color="gray">{data.user.bio.replace(/\n/g, ' ')}</Text>}
      </Box>

      {/* Calendar */}
      <Calendar
        weeks={data.stats.contributionsCollection.contributionCalendar.weeks}
        theme={currentTheme}
      />

      {/* Stats & Languages Grid */}
      <Box flexDirection="column" gap={1}>
        <Stats user={data.user} stats={data.stats} theme={currentTheme} />
        <Languages stats={data.stats} theme={currentTheme} />
      </Box>
      
      {/* Footer */}
      <Box marginTop={1} justifyContent="space-between">
         <Text color="gray" dimColor>gitfetch v1.0.0</Text>
         <Text color="gray" dimColor>Theme: {currentTheme.name} (t) • Quit (q)</Text>
      </Box>
    </Box>
  );
};

export default App;
