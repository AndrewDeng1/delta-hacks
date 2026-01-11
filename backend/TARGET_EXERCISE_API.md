# Target Exercise API

The target exercise system allows the frontend to set which exercise the motion detection script should focus on.

## Endpoints

### GET /target-exercise

Get the current target exercise.

**Response:**
```json
{
  "target": "squats"
}
```

### POST /target-exercise

Set the target exercise.

**Request Body:**
```json
{
  "target": "squats"
}
```

**Valid targets:**
- `"squats"`
- `"jumping_jacks"`
- `"high_knees"`

**Response:**
```json
{
  "success": true,
  "target": "squats"
}
```

## Frontend Integration Example

```javascript
// Set target exercise when user selects from dropdown
async function setTargetExercise(exerciseName) {
  const response = await fetch('http://localhost:5000/target-exercise', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      target: exerciseName // "squats", "jumping_jacks", or "high_knees"
    })
  });

  const result = await response.json();
  console.log('Target set to:', result.target);
}

// Example usage when user clicks exercise option
// <button onClick={() => setTargetExercise('squats')}>Squats</button>
// <button onClick={() => setTargetExercise('jumping_jacks')}>Jumping Jacks</button>
// <button onClick={() => setTargetExercise('high_knees')}>High Knees</button>
```

## How It Works

1. Frontend sends POST request to `/target-exercise` with the exercise name
2. Backend writes the target to `target_exercise.json`
3. The motion detection script (`script.py`) checks this file every 30 frames (~1 second)
4. Script switches to detecting only the target exercise
5. Only the target exercise's reps are counted

## Benefits

- **Simpler detection**: Script only focuses on one exercise at a time
- **More accurate**: No confusion between similar movements
- **Better thresholds**: Can tune each exercise independently
- **User control**: Frontend can switch exercises based on challenge requirements
