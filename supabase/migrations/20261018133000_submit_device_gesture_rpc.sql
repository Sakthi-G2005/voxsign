-- RPC function to allow hardware devices (ESP32) to submit gestures directly to Supabase via PostgREST
-- Works with both JSON payload object and direct named parameters

CREATE OR REPLACE FUNCTION public.submit_device_gesture(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _device_key text;
  _gesture_code text;
  _gesture_message text;
  _sensor_data jsonb;
  _device record;
  _request_id uuid;
  _code text;
  _message text;
BEGIN
  -- Support both device_key and p_device_key naming
  _device_key := COALESCE(payload->>'device_key', payload->>'p_device_key');
  _gesture_code := COALESCE(payload->>'gesture_code', payload->>'p_gesture_code', 'HELP');
  _gesture_message := COALESCE(payload->>'gesture_message', payload->>'p_gesture_message');
  _sensor_data := COALESCE(payload->'sensor_data', payload->'p_sensor_data', '{}'::jsonb);

  IF _device_key IS NULL OR TRIM(_device_key) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Missing device_key in payload');
  END IF;

  -- 1. Validate device key against public.devices
  SELECT id, user_id, is_active INTO _device
  FROM public.devices
  WHERE api_key = TRIM(_device_key);

  IF _device.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid device key');
  END IF;

  IF NOT _device.is_active THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Device is disabled');
  END IF;

  _code := UPPER(REPLACE(TRIM(_gesture_code), ' ', '_'));
  _message := COALESCE(NULLIF(TRIM(_gesture_message), ''), REPLACE(_code, '_', ' '));

  -- 2. Create help request for the device owner
  INSERT INTO public.help_requests (sender_id, gesture_code, message, status, source)
  VALUES (_device.user_id, _code, _message, 'sent', 'device')
  RETURNING id INTO _request_id;

  -- 3. Log gesture event with sensor readings
  INSERT INTO public.gesture_events (
    user_id,
    device_id,
    help_request_id,
    gesture_code,
    gesture_message,
    sensor_data,
    source
  )
  VALUES (
    _device.user_id,
    _device.id,
    _request_id,
    _code,
    _message,
    _sensor_data,
    'device'
  );

  -- 4. Update device last seen timestamp
  UPDATE public.devices
  SET last_seen_at = now()
  WHERE id = _device.id;

  RETURN jsonb_build_object(
    'ok', true,
    'help_request_id', _request_id,
    'gesture_code', _code,
    'gesture_message', _message,
    'status', 'sent'
  );
END;
$$;

-- Allow anonymous hardware devices to call this RPC with publishable key
GRANT EXECUTE ON FUNCTION public.submit_device_gesture(jsonb) TO anon, authenticated, service_role;
