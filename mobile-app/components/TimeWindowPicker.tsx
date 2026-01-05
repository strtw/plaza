import { View, Text, Pressable } from 'react-native';
import { useState } from 'react';
import { format, setHours, setMinutes } from 'date-fns';

interface Props {
  startTime: Date;
  endTime: Date;
  onStartTimeChange: (date: Date) => void;
  onEndTimeChange: (date: Date) => void;
}

export function TimeWindowPicker({
  startTime,
  endTime,
  onStartTimeChange,
  onEndTimeChange,
}: Props) {
  // Simple hour picker - can be enhanced with a proper time picker later
  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <View>
      <Text style={{ fontSize: 16, marginBottom: 10 }}>Time Window (Today)</Text>
      
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Text style={{ marginBottom: 5 }}>Start Time</Text>
          <Text style={{ fontSize: 18, padding: 10, borderWidth: 1 }}>
            {format(startTime, 'HH:mm')}
          </Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{ marginBottom: 5 }}>End Time</Text>
          <Text style={{ fontSize: 18, padding: 10, borderWidth: 1 }}>
            {format(endTime, 'HH:mm')}
          </Text>
        </View>
      </View>

      <Text style={{ fontSize: 12, color: '#666', marginTop: 5 }}>
        Tap to select times (simplified for MVP - add proper picker later)
      </Text>
    </View>
  );
}

