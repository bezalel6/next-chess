import React, { useEffect, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Chip,
  Divider,
  Badge,
} from "@mui/material";
import {
  FiberManualRecord as LiveIcon,
  SportsEsports as GameIcon,
  Person as UserIcon,
  SwapHoriz as MoveIcon,
  Block as BanIcon,
} from "@mui/icons-material";
import { supabase } from "@/utils/supabase";
import { format } from "date-fns";

interface RealtimeEvent {
  id: string;
  type: "game_started" | "move_made" | "ban_made" | "game_ended" | "user_joined";
  timestamp: string;
  data: any;
  message: string;
}

export default function RealtimeMonitor() {
  const [events, setEvents] = useState<RealtimeEvent[]>([]);
  const [activeConnections, setActiveConnections] = useState(0);

  useEffect(() => {
    // Subscribe to game updates
    const gameChannel = supabase
      .channel("admin-games")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games" },
        (payload) => {
          handleGameEvent(payload);
        }
      )
      .subscribe();

    // Subscribe to move updates
    const moveChannel = supabase
      .channel("admin-moves")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "moves" },
        (payload) => {
          handleMoveEvent(payload);
        }
      )
      .subscribe();

    // Subscribe to ban updates
    const banChannel = supabase
      .channel("admin-bans")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ban_history" },
        (payload) => {
          handleBanEvent(payload);
        }
      )
      .subscribe();

    // Subscribe to user updates
    const userChannel = supabase
      .channel("admin-users")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "profiles" },
        (payload) => {
          handleUserEvent(payload);
        }
      )
      .subscribe();

    // Track active connections
    const presenceChannel = supabase.channel("admin-presence");
    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        setActiveConnections(Object.keys(state).length);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(gameChannel);
      supabase.removeChannel(moveChannel);
      supabase.removeChannel(banChannel);
      supabase.removeChannel(userChannel);
      supabase.removeChannel(presenceChannel);
    };
  }, []);

  const handleGameEvent = async (payload: any) => {
    let eventType: RealtimeEvent["type"];
    let message = "";

    if (payload.eventType === "INSERT") {
      eventType = "game_started";
      message = `New game started: ${payload.new.id}`;
    } else if (
      payload.eventType === "UPDATE" &&
      payload.new.status === "finished"
    ) {
      eventType = "game_ended";
      const winner = payload.new.result === "draw" ? "Draw" : `${payload.new.result} wins`;
      message = `Game ${payload.new.id} ended: ${winner}`;
    } else {
      return; // Skip other updates
    }

    addEvent({
      id: `${eventType}-${Date.now()}`,
      type: eventType,
      timestamp: new Date().toISOString(),
      data: payload.new,
      message,
    });
  };

  const handleMoveEvent = (payload: any) => {
    addEvent({
      id: `move-${Date.now()}`,
      type: "move_made",
      timestamp: new Date().toISOString(),
      data: payload.new,
      message: `Move in game ${payload.new.game_id}: ${payload.new.move.from}→${payload.new.move.to}`,
    });
  };

  const handleBanEvent = (payload: any) => {
    addEvent({
      id: `ban-${Date.now()}`,
      type: "ban_made",
      timestamp: new Date().toISOString(),
      data: payload.new,
      message: `Ban in game ${payload.new.game_id}: ${payload.new.banned_move.from}${payload.new.banned_move.to} blocked`,
    });
  };

  const handleUserEvent = (payload: any) => {
    addEvent({
      id: `user-${Date.now()}`,
      type: "user_joined",
      timestamp: new Date().toISOString(),
      data: payload.new,
      message: `New user joined: ${payload.new.username || payload.new.email}`,
    });
  };

  const addEvent = (event: RealtimeEvent) => {
    setEvents((prev) => [event, ...prev].slice(0, 50)); // Keep last 50 events
  };

  const getEventIcon = (type: RealtimeEvent["type"]) => {
    switch (type) {
      case "game_started":
        return <GameIcon />;
      case "move_made":
        return <MoveIcon />;
      case "ban_made":
        return <BanIcon />;
      case "game_ended":
        return <GameIcon />;
      case "user_joined":
        return <UserIcon />;
      default:
        return <LiveIcon />;
    }
  };

  const getEventColor = (type: RealtimeEvent["type"]) => {
    switch (type) {
      case "game_started":
        return "primary";
      case "move_made":
        return "info";
      case "ban_made":
        return "warning";
      case "game_ended":
        return "success";
      case "user_joined":
        return "secondary";
      default:
        return "default";
    }
  };

  return (
    <Paper sx={{ p: 2, height: "600px", display: "flex", flexDirection: "column" }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Live Activity Monitor</Typography>
        <Badge badgeContent={activeConnections} color="success">
          <Chip
            icon={<LiveIcon />}
            label="Live"
            color="error"
            size="small"
            sx={{
              animation: "pulse 2s infinite",
              "@keyframes pulse": {
                "0%": { opacity: 1 },
                "50%": { opacity: 0.5 },
                "100%": { opacity: 1 },
              },
            }}
          />
        </Badge>
      </Box>

      <Divider />

      <List sx={{ flex: 1, overflow: "auto", mt: 1 }}>
        {events.length === 0 ? (
          <Box
            display="flex"
            justifyContent="center"
            alignItems="center"
            height="100%"
          >
            <Typography color="textSecondary">
              Waiting for live events...
            </Typography>
          </Box>
        ) : (
          events.map((event, index) => (
            <React.Fragment key={event.id}>
              <ListItem
                sx={{
                  animation: index === 0 ? "slideIn 0.3s ease-out" : "none",
                  "@keyframes slideIn": {
                    from: {
                      transform: "translateX(-100%)",
                      opacity: 0,
                    },
                    to: {
                      transform: "translateX(0)",
                      opacity: 1,
                    },
                  },
                }}
              >
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: `${getEventColor(event.type)}.main` }}>
                    {getEventIcon(event.type)}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={event.message}
                  secondary={format(new Date(event.timestamp), "HH:mm:ss")}
                />
                <Chip
                  label={event.type.replace("_", " ")}
                  size="small"
                  color={getEventColor(event.type) as any}
                  variant="outlined"
                />
              </ListItem>
              {index < events.length - 1 && <Divider variant="inset" component="li" />}
            </React.Fragment>
          ))
        )}
      </List>
    </Paper>
  );
}