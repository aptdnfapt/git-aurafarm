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

const Label = ({ children }) => <Text color="white">{children}</Text>;
const Value = ({ children, theme }) => <Text bold color={theme.text}>{children}</Text>;

const CalendarLegend = ({ theme }) => (
  <Box flexDirection="row" justifyContent="flex-end" marginTop={0}>
    <Text color="gray" dimColor>Less </Text>
    {theme.levels.slice(1).map((color, i) => (
       <Text key={i} color={color}>■ </Text>
    ))}
    <Text color="gray" dimColor> More</Text>
  </Box>
);

const PieChart = ({ data, radius = 6 }) => {
  const diameter = radius * 2;
  const rows = [];

  // Calculate total for normalization
  const total = data.reduce((acc, item) => acc + item.percent, 0);
  
  // Create cumulative percentages for slice boundaries
  let cumulative = 0;
  const slices = data.map(item => {
    cumulative += item.percent;
    return { ...item, endAngle: (cumulative / total) * 2 * Math.PI };
  });

  for (let y = 0; y < diameter; y++) {
    const rowChars = [];
    for (let x = 0; x < diameter * 2; x++) { // Multiply x by 2 for aspect ratio correction
      // Normalize coordinates to -1 to 1
      const dx = (x / 2 - radius + 0.5) / radius;
      const dy = (y - radius + 0.5) / radius;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= 1) {
        // Calculate angle
        let angle = Math.atan2(dy, dx);
        if (angle < 0) angle += 2 * Math.PI; // Normalize to 0-2PI
        
        // Find which slice this angle belongs to
        // Rotate by -PI/2 to start from top
        let checkAngle = angle + Math.PI / 2;
        if (checkAngle > 2 * Math.PI) checkAngle -= 2 * Math.PI;

        const slice = slices.find(s => checkAngle <= s.endAngle) || slices[slices.length - 1];
        rowChars.push(<Text key={x} color={slice.color}>█</Text>);
      } else {
        rowChars.push(<Text key={x}> </Text>);
      }
    }
    rows.push(<Box key={y} flexDirection="row">{rowChars}</Box>);
  }

  return (
    <Box flexDirection="column" alignItems="center">
      <Box flexDirection="column">{rows}</Box>
      <Box flexDirection="column" marginTop={1} marginLeft={2}>
        {data.map(lang => (
          <Box key={lang.name} flexDirection="row">
            <Text color={lang.color}>■ </Text>
            <Text color="white">{lang.name} ({Math.round(lang.percent)}%)</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

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

const Calendar = ({ weeks, theme, width }) => {
  // Calculate how many weeks fit
  const maxWeeks = Math.max(10, Math.floor((width - 2) / 2));
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
    <Box flexDirection="column">
      <MonthHeader weeks={visibleWeeks} />
      {rows}
      <CalendarLegend theme={theme} />
    </Box>
  );
};

const StatRow = ({ label, value, theme }) => (
  <Box flexDirection="row" justifyContent="space-between" width="100%" marginBottom={0}>
    <Label>{label}</Label>
    <Value theme={theme}>{value}</Value>
  </Box>
);

const Stats = ({ stats, theme }) => {
  const stars = calculateTotalStars(stats.repositories);
  const forks = calculateTotalForks(stats.repositories);
  const streaks = calculateStreaks(stats.contributionsCollection.contributionCalendar.weeks);
  const total = stats.contributionsCollection.contributionCalendar.totalContributions;
  const followers = stats.followers?.totalCount || 0;

  return (
    <Box flexDirection="column" width="100%">
      <Box marginBottom={1} borderStyle="single" borderBottomColor="gray" borderTop={false} borderLeft={false} borderRight={false}>
        <Text bold color={theme.title}>STATS</Text>
      </Box>
      <Box flexDirection="column" gap={0}>
        <StatRow label="Repositories" value={stats.repositories.totalCount} theme={theme} />
        <StatRow label="Followers" value={followers} theme={theme} />
        <StatRow label="Total Stars" value={stars} theme={theme} />
        <StatRow label="Total Forks" value={forks} theme={theme} />
        <StatRow label="Contributions" value={total} theme={theme} />
        <StatRow label="Current Streak" value={`${streaks.current} days`} theme={theme} />
      </Box>
    </Box>
  );
};

const Profile = ({ user, theme }) => {
  const social = user.socialAccounts?.nodes || [];
  
  return (
    <Box flexDirection="column" width="100%">
      <Box marginBottom={1} borderStyle="single" borderBottomColor="gray" borderTop={false} borderLeft={false} borderRight={false}>
        <Text bold color={theme.title}>PROFILE</Text>
      </Box>
      
      <Box flexDirection="column" gap={0}>
        {user.company && (
          <Box flexDirection="column" marginBottom={1}>
            <Label>Company</Label>
            <Value theme={theme}>{user.company}</Value>
          </Box>
        )}
        
        {user.location && (
          <Box flexDirection="column" marginBottom={1}>
            <Label>Location</Label>
            <Value theme={theme}>{user.location}</Value>
          </Box>
        )}

        {user.websiteUrl && (
          <Box flexDirection="column" marginBottom={1}>
            <Label>Website</Label>
            <Value theme={theme}>{user.websiteUrl}</Value>
          </Box>
        )}

        {social.length > 0 && (
          <Box flexDirection="column" marginBottom={1}>
            <Label>Socials</Label>
            {social.map((s, i) => (
              <Box key={i} flexDirection="column">
                <Text color={theme.text}>{s.provider}: {s.url}</Text>
              </Box>
            ))}
          </Box>
        )}

        {user.bio && (
          <Box marginTop={1}>
            <Text italic color="gray">{user.bio.replace(/\n/g, ' ')}</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
};

const App = ({ flags }) => {
  const { stdout } = useStdout();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [themeIndex, setThemeIndex] = useState(0);
  const [columns, setColumns] = useState(stdout.columns || 80);

  useEffect(() => {
    const onResize = () => {
      setColumns(stdout.columns);
      // Clear screen on resize to prevent artifacts
      process.stdout.write('\x1Bc');
    };
    stdout.on('resize', onResize);
    return () => stdout.off('resize', onResize);
  }, [stdout]);

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
  const topLangs = calculateTopLanguages(data.stats.repositories);

  // Layout Calculations
  // Left column takes priority for content, Right column is for the big chart
  const rightColumnWidth = 45;
  const leftColumnWidth = Math.max(40, columns - rightColumnWidth - 4);

  return (
    <Box flexDirection="column" padding={1}>
      {process.stdin.isTTY && <InputHandler toggleTheme={toggleTheme} />}

      {/* Header */}
      <Box flexDirection="row" justifyContent="space-between" marginBottom={1} borderStyle="single" borderBottomColor="gray" borderTop={false} borderLeft={false} borderRight={false} paddingBottom={1}>
        <Box>
          <Text bold color={currentTheme.title} size="large">{data.user.name || data.user.login}</Text>
          <Text color="gray"> (@{data.user.login})</Text>
        </Box>
        <Text color="gray">gitfetch v1.0.0</Text>
      </Box>

      <Box flexDirection="row" gap={2}>
        {/* Left Column: Calendar, Profile, Stats */}
        <Box flexDirection="column" width={leftColumnWidth}>
          {/* Calendar */}
          <Box marginBottom={1}>
            <Calendar
              weeks={data.stats.contributionsCollection.contributionCalendar.weeks}
              theme={currentTheme}
              width={leftColumnWidth}
            />
          </Box>

          <Box flexDirection="row" gap={2} marginTop={1}>
             {/* Profile */}
             <Box flexDirection="column" width="50%">
                <Profile user={data.user} theme={currentTheme} />
             </Box>
             
             {/* Stats with Left Border acting as Divider */}
             <Box flexDirection="column" width="50%" borderStyle="single" borderLeftColor="gray" borderTop={false} borderBottom={false} borderRight={false} paddingLeft={1}>
                <Stats stats={data.stats} theme={currentTheme} />
             </Box>
          </Box>
        </Box>

        {/* Right Column: Big Pie Chart */}
        <Box flexDirection="column" width={rightColumnWidth} alignItems="center" justifyContent="center">
          <Box marginBottom={1}>
            <Text bold color={currentTheme.title} underline>LANGUAGES</Text>
          </Box>
          <PieChart data={topLangs} radius={10} />
        </Box>
      </Box>
      
      {/* Footer */}
      <Box marginTop={1} justifyContent="center">
         <Text color="gray" dimColor>Theme: {currentTheme.name} (t) • Quit (q)</Text>
      </Box>
    </Box>
  );
};

export default App;
