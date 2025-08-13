import React, { useEffect, useState } from "react";
import { Box, Paper, Typography, ButtonGroup, Button } from "@mui/material";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { supabase } from "@/utils/supabase";
import { format, subDays, startOfDay } from "date-fns";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

type TimeRange = "7d" | "30d" | "3m";

export default function GameChart() {
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");
  const [chartData, setChartData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChartData();
  }, [timeRange]);

  const loadChartData = async () => {
    setLoading(true);
    try {
      const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;
      const startDate = startOfDay(subDays(new Date(), days - 1));

      // Generate date labels
      const labels = [];
      const dateMap = new Map();
      
      for (let i = 0; i < days; i++) {
        const date = subDays(new Date(), days - 1 - i);
        const dateStr = format(date, "yyyy-MM-dd");
        labels.push(format(date, days > 30 ? "MMM d" : "MMM d"));
        dateMap.set(dateStr, 0);
      }

      // Fetch games data
      const { data: games } = await supabase
        .from("games")
        .select("created_at, status")
        .gte("created_at", startDate.toISOString());

      // Count games per day
      const gamesPerDay = new Map(dateMap);
      const completedPerDay = new Map(dateMap);

      games?.forEach((game) => {
        const dateStr = format(new Date(game.created_at), "yyyy-MM-dd");
        if (gamesPerDay.has(dateStr)) {
          gamesPerDay.set(dateStr, gamesPerDay.get(dateStr)! + 1);
          if (game.status === "finished") {
            completedPerDay.set(dateStr, completedPerDay.get(dateStr)! + 1);
          }
        }
      });

      // Fetch user registrations
      const { data: users } = await supabase
        .from("profiles")
        .select("created_at")
        .gte("created_at", startDate.toISOString());

      const usersPerDay = new Map(dateMap);
      users?.forEach((user) => {
        const dateStr = format(new Date(user.created_at), "yyyy-MM-dd");
        if (usersPerDay.has(dateStr)) {
          usersPerDay.set(dateStr, usersPerDay.get(dateStr)! + 1);
        }
      });

      // Convert maps to arrays
      const gamesData = Array.from(gamesPerDay.values());
      const completedData = Array.from(completedPerDay.values());
      const usersData = Array.from(usersPerDay.values());

      setChartData({
        labels,
        datasets: [
          {
            label: "Games Started",
            data: gamesData,
            borderColor: "rgb(75, 192, 192)",
            backgroundColor: "rgba(75, 192, 192, 0.2)",
            tension: 0.3,
            fill: true,
          },
          {
            label: "Games Completed",
            data: completedData,
            borderColor: "rgb(255, 99, 132)",
            backgroundColor: "rgba(255, 99, 132, 0.2)",
            tension: 0.3,
            fill: true,
          },
          {
            label: "New Users",
            data: usersData,
            borderColor: "rgb(54, 162, 235)",
            backgroundColor: "rgba(54, 162, 235, 0.2)",
            tension: 0.3,
            fill: true,
          },
        ],
      });
    } catch (error) {
      console.error("Error loading chart data:", error);
    } finally {
      setLoading(false);
    }
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
      },
      title: {
        display: false,
      },
      tooltip: {
        mode: "index" as const,
        intersect: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
        },
      },
    },
    interaction: {
      mode: "nearest" as const,
      axis: "x" as const,
      intersect: false,
    },
  };

  return (
    <Paper sx={{ p: 2, height: "400px" }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Activity Overview</Typography>
        <ButtonGroup size="small">
          <Button
            variant={timeRange === "7d" ? "contained" : "outlined"}
            onClick={() => setTimeRange("7d")}
          >
            7 Days
          </Button>
          <Button
            variant={timeRange === "30d" ? "contained" : "outlined"}
            onClick={() => setTimeRange("30d")}
          >
            30 Days
          </Button>
          <Button
            variant={timeRange === "3m" ? "contained" : "outlined"}
            onClick={() => setTimeRange("3m")}
          >
            3 Months
          </Button>
        </ButtonGroup>
      </Box>

      <Box height="calc(100% - 60px)">
        {!loading && chartData && (
          <Line data={chartData} options={options} />
        )}
      </Box>
    </Paper>
  );
}