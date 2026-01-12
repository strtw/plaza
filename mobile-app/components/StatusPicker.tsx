import { View, Text, Pressable } from 'react-native';
import { AvailabilityStatus } from '../lib/types';

interface Props {
  value: AvailabilityStatus;
  onChange: (status: AvailabilityStatus) => void;
}

export function StatusPicker({ value, onChange }: Props) {
  const statuses = [
    { value: AvailabilityStatus.AVAILABLE, label: 'Available', color: 'green' },
    { value: AvailabilityStatus.UNAVAILABLE, label: 'Unavailable', color: 'red' },
  ];

  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
      {statuses.map((status) => (
        <Pressable
          key={status.value}
          onPress={() => onChange(status.value)}
          style={{
            alignItems: 'center',
            padding: 10,
            borderWidth: value === status.value ? 2 : 0,
            borderColor: 'blue',
          }}
        >
          <View
            style={{
              width: 50,
              height: 50,
              borderRadius: 25,
              backgroundColor: status.color,
              marginBottom: 5,
            }}
          />
          <Text>{status.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

