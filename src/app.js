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

const Calendar = ({ weeks, theme }) => {
  const { stdout } = useStdout();
  const [columns, setColumns] = useState(stdout.columns);

  useEffect(() => {
    const onResize = () => setColumns(stdout.columns);
    stdout.on('resize', onResize);
    return () => stdout.off('resize', onResize);
  }, [stdout]);

  const maxWeeks = Math.floor((columns - 6) / 2); 
  const visibleWeeks = weeks.slice(-maxWeeks);

  const rows = [];
  for (let day = 0; day < 7; day++) {
    const rowCells = visibleWeeks.map((week, index) => {
      const dayData = week.contributionDays[day];
      if (!dayData) return <Text key={`cell-${index}`}>  </Text>;
      
      // Determine color based on count (simple mapping)
      // 0 -> level 0, 1-3 -> level 1, 4-6 -> level 2, 7-9 -> level 3, 10+ -> level 4
      const count = dayData.contributionCount;
      let level = 0;
      if (count > 0) level = 1;
      if (count > 3) level = 2;
      if (count > 6) level = 3;
      if (count > 9) level = 4;

      const color = theme.levels[level];

      return (
        <Text key={`cell-${index}`} color={color}>
          ■{" "}
        </Text>
      );
    });
    rows.push(
      <Box key={`row-${day}`} flexDirection="row">
        {rowCells}
      </Box>
    );
  }

  // alignSelf="flex-start" prevents the box from stretching to full width
  return (
    <Box 
      flexDirection="column" 
      marginTop={1} 
      borderStyle="round" 
      borderColor={theme.border} 
      title="Contribution Graph"
      alignSelf="flex-start"
    >
      {rows}
      <Box marginTop={1} justifyContent="space-between">
         <Text color="gray">Showing last {visibleWeeks.length} weeks</Text>
         <Text color={theme.text}>Theme: {theme.name} (Press 't')</Text>
      </Box>
    </Box>
  );
};

const ProgressBar = ({ percent, color, width = 20 }) => {
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  return (
    <Text>
      <Text color={color}>{"█".repeat(filled)}</Text>
      <Text color="gray">{"░".repeat(empty)}</Text>
    </Text>
  );
};

const Overview = ({ user, stats, theme }) => {
  const stars = calculateTotalStars(stats.repositories);
  const forks = calculateTotalForks(stats.repositories);

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={theme.border} title="Overview" paddingX={1}>
       <Box justifyContent="space-between">
         <Text color={theme.text}>Repositories</Text>
         <Text>{stats.repositories.totalCount}</Text>
       </Box>
       <Box justifyContent="space-between">
         <Text color={theme.text}>Followers</Text>
         <Text>{user.followers?.totalCount || stats.followers?.totalCount}</Text>
       </Box>
       <Box justifyContent="space-between">
         <Text color={theme.text}>Stars</Text>
         <Text>{stars}</Text>
       </Box>
       <Box justifyContent="space-between">
         <Text color={theme.text}>Forks</Text>
         <Text>{forks}</Text>
       </Box>
    </Box>
  );
};

const Languages = ({ stats, theme }) => {
  const topLangs = calculateTopLanguages(stats.repositories);
  // Calculate total count to determine percentage
  const total = topLangs.reduce((acc, curr) => acc + curr.count, 0);

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={theme.border} title="Languages" paddingX={1} flexGrow={1}>
      {topLangs.map(lang => {
        const percent = (lang.count / total) * 100;
        return (
          <Box key={lang.name} flexDirection="row" justifyContent="space-between">
             <Box width={12}><Text color={theme.text}>{lang.name}</Text></Box>
             <Box marginRight={2}><ProgressBar percent={percent} color={lang.color} width={15} /></Box>
             <Text>{Math.round(percent)}%</Text>
          </Box>
        );
      })}
    </Box>
  );
};

const Achievements = ({ stats, theme }) => {
  const streaks = calculateStreaks(stats.contributionsCollection.contributionCalendar.weeks);
  const total = stats.contributionsCollection.contributionCalendar.totalContributions;
  
  return (
    <Box flexDirection="column" borderStyle="single" borderColor={theme.border} title="Achievements" paddingX={1} marginTop={0}>
       <Box flexDirection="row" justifyContent="space-between">
          <Text>🔥 Current Streak</Text>
          <Text color={theme.text}>{streaks.current} days</Text>
       </Box>
       <Box flexDirection="row" justifyContent="space-between">
          <Text>🏆 Longest Streak</Text>
          <Text color={theme.text}>{streaks.longest} days</Text>
       </Box>
       <Box flexDirection="row" justifyContent="space-between">
          <Text>💎 Total Contribs</Text>
          <Text color={theme.text}>{total}</Text>
       </Box>
    </Box>
  );
};

const ActivityItem = ({ item, theme }) => (
  <Box marginLeft={1}>
    <Text>
      <Text color="gray">• </Text>
      <Text>{item.title.slice(0, 20)}{item.title.length > 20 ? '…' : ''}</Text>
      <Text color="gray" dimColor> ({item.repository.name})</Text>
    </Text>
  </Box>
);

const Activity = ({ stats, theme }) => {
  return (
    <Box flexDirection="column" borderStyle="single" borderColor={theme.border} title="Activity" paddingX={1} marginTop={0} flexGrow={1}>
       <Box flexDirection="column">
          <Box justifyContent="space-between">
            <Text bold color={theme.title}>Pull Requests</Text>
            <Text color="gray">{stats.pullRequests.totalCount}</Text>
          </Box>
          {stats.pullRequests.nodes.length === 0 ? (
             <Text color="gray" italic>  None</Text>
          ) : (
             stats.pullRequests.nodes.slice(0, 3).map(pr => (
                <ActivityItem key={pr.number} item={pr} theme={theme} />
             ))
          )}
       </Box>
       <Box flexDirection="column" marginTop={1}>
          <Box justifyContent="space-between">
            <Text bold color={theme.title}>Issues</Text>
            <Text color="gray">{stats.issues.totalCount}</Text>
          </Box>
          {stats.issues.nodes.length === 0 ? (
             <Text color="gray" italic>  None</Text>
          ) : (
             stats.issues.nodes.slice(0, 3).map(issue => (
                <ActivityItem key={issue.number} item={issue} theme={theme} />
             ))
          )}
       </Box>
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
        const res = await fetchAllStats(flags?.mock);
        setData(res);
      } catch (e) {
        setError(e.message);
      }
    };
    load();
  }, [flags]);

  if (error) {
    return <Text color="red">Error: {error}</Text>;
  }

  if (!data) {
    return <Text>Loading stats...</Text>;
  }

  const currentTheme = themes[themeIndex];

  return (
    <Box flexDirection="column" padding={1} height="100%">
      {process.stdin.isTTY && <InputHandler toggleTheme={toggleTheme} />}
      
      {/* Top Section: Header & Calendar */}
      <Box flexDirection="column" marginBottom={1}>
         <Box justifyContent="center" marginBottom={1} flexDirection="column" alignItems="center">
            <Text bold color={currentTheme.title} markup>{data.user.name || data.user.login} <Text color="gray">(@{data.user.login})</Text></Text>
            {data.user.bio && <Text italic color="gray">{data.user.bio.replace(/\n/g, ' ')}</Text>}
         </Box>
         <Calendar 
            weeks={data.stats.contributionsCollection.contributionCalendar.weeks} 
            theme={currentTheme}
         />
      </Box>

      {/* Bottom Section: Split View */}
      <Box flexDirection="row" gap={1}>
         {/* Left Column */}
         <Box flexDirection="column" width="40%" gap={0}>
            <Overview user={data.user} stats={data.stats} theme={currentTheme} />
            <Achievements stats={data.stats} theme={currentTheme} />
         </Box>

         {/* Right Column */}
         <Box flexDirection="column" width="60%" gap={0}>
            <Languages stats={data.stats} theme={currentTheme} />
            <Activity stats={data.stats} theme={currentTheme} />
         </Box>
      </Box>

      {process.stdin.isTTY && <Box marginTop={1}><Text color="gray" italic>Press 't' to toggle theme • 'q' to quit</Text></Box>}
    </Box>
  );
};

export default App;
