import React, { useState, useEffect } from 'react';
import { Box, Text, useStdout, useInput, useApp } from 'ink';
import { fetchAllStats, calculateStreaks } from './fetcher.js';
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

const UserStats = ({ user, stats, theme }) => {
  const streaks = calculateStreaks(stats.contributionsCollection.contributionCalendar.weeks);

  return (
    <Box flexDirection="column" marginLeft={2}>
      <Text bold color={theme.title}>{user.name || user.login}</Text>
      <Text>@{user.login}</Text>
      <Box marginTop={1} flexDirection="column">
         <Text>Repositories: <Text color={theme.text}>{stats.repositories.totalCount}</Text></Text>
         <Text>Followers:    <Text color={theme.text}>{user.followers?.totalCount || stats.followers?.totalCount}</Text></Text>
         <Text>Contributions:<Text color={theme.text}>{stats.contributionsCollection.contributionCalendar.totalContributions}</Text></Text>
         <Box marginTop={1}>
            <Text>Streak: <Text color={theme.text}>{streaks.current} days</Text></Text>
            <Text> (Max: <Text color={theme.text}>{streaks.longest}</Text>)</Text>
         </Box>
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
      <Box flexDirection="row">
        {/* ASCII Art Placeholder */}
        <Box borderStyle="single" borderColor={currentTheme.border} padding={1}>
            <Text color={currentTheme.title}>
              {`
   __...--~~~~~-._   _.-~~~~~--...__
 //               \`V'               \\
//                 |                 \\
//__...--~~~~~~-._  |  _.-~~~~~~--...__\\
//__.....----~~~~._\\ | /_.~~~~----.....__\\
===================\\|/===================
              gitfetch-js
              `}
            </Text>
        </Box>
        
        <UserStats user={data.user} stats={data.stats} theme={currentTheme} />
      </Box>
      
      <Calendar 
        weeks={data.stats.contributionsCollection.contributionCalendar.weeks} 
        theme={currentTheme}
      />
      {process.stdin.isTTY && <Text color="gray" italic>Press 'q' to quit</Text>}
    </Box>
  );
};

export default App;
