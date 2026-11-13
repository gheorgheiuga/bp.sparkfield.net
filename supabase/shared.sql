-- Shared Horizon data. Tables are private to the server's service role.
CREATE TABLE IF NOT EXISTS public.horizon_ideas (
  id text PRIMARY KEY, record jsonb NOT NULL, revision bigint NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.horizon_projects (
  id text PRIMARY KEY, record jsonb NOT NULL, revision bigint NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS horizon_project_source ON public.horizon_projects ((record->>'sourceIdeaId')) WHERE record ? 'sourceIdeaId';
CREATE TABLE IF NOT EXISTS public.horizon_settings (
  id text PRIMARY KEY CHECK(id='main'), record jsonb NOT NULL, revision bigint NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.horizon_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horizon_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horizon_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.horizon_ideas, public.horizon_projects, public.horizon_settings FROM anon, authenticated, PUBLIC;
GRANT ALL ON public.horizon_ideas, public.horizon_projects, public.horizon_settings TO service_role;

-- The handoff must either create the initiative and update the idea together, or do neither.
CREATE OR REPLACE FUNCTION public.horizon_pickup(p_idea_id text, p_revision bigint, p_project_id text, p_actor text, p_owner text, p_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE i horizon_ideas%ROWTYPE; j jsonb; p jsonb; today text := to_char(current_date,'YYYY-MM-DD');
BEGIN
  SELECT * INTO i FROM horizon_ideas WHERE id=p_idea_id FOR UPDATE;
  IF NOT FOUND OR i.revision<>p_revision OR i.record ? 'initiativeId' THEN RETURN NULL; END IF;
  p := jsonb_build_object('id',p_project_id,'sample',coalesce((i.record->>'illustrative')::boolean,false),'pickedUp',true,'sourceIdeaId',p_idea_id,'created',today,'createdBy',p_actor,'idea',jsonb_build_object('title',i.record->>'title','problem',i.record->>'problem','solution',i.record->>'solution','owner',p_owner,'sourceDimension',i.record->>'dimension'),'pickupNote',p_note,'gates',jsonb_build_object('g0',jsonb_build_object('decision',''),'g1',jsonb_build_object('decision',''),'g2',jsonb_build_object('decision','')));
  INSERT INTO horizon_projects(id,record) VALUES(p_project_id,p);
  j := i.record || jsonb_build_object('status','In Business Case','initiativeId',p_project_id,'initiativeOwner',p_owner,'handoff',p_note,'feedback','Picked up for business-case development by '||p_owner||'.','history',coalesce(i.record->'history','[]'::jsonb)||jsonb_build_array(jsonb_build_object('date',today,'text','Picked up by '||p_actor||' for business-case development.')));
  UPDATE horizon_ideas SET record=j, revision=revision+1, updated_at=now() WHERE id=p_idea_id;
  RETURN jsonb_build_object('idea',j,'project',p);
END $$;
REVOKE ALL ON FUNCTION public.horizon_pickup(text,bigint,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.horizon_pickup(text,bigint,text,text,text,text) TO service_role;

-- Imported records are inserted atomically and never overwrite shared records.
CREATE OR REPLACE FUNCTION public.horizon_import(p_ideas jsonb, p_projects jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE x jsonb; y jsonb;
BEGIN
  FOR x IN SELECT value FROM jsonb_array_elements(p_ideas) LOOP
    INSERT INTO horizon_ideas(id,record) VALUES(x->>'id',x);
  END LOOP;
  FOR x IN SELECT value FROM jsonb_array_elements(p_projects) LOOP
    IF x ? 'sourceIdeaId' THEN
      SELECT record INTO y FROM horizon_ideas WHERE id=x->>'sourceIdeaId';
      IF y IS NULL OR y->>'initiativeId' IS DISTINCT FROM x->>'id' THEN RAISE EXCEPTION 'Invalid source idea linkage'; END IF;
    END IF;
    INSERT INTO horizon_projects(id,record) VALUES(x->>'id',x);
  END LOOP;
  FOR x IN SELECT value FROM jsonb_array_elements(p_ideas) WHERE value ? 'initiativeId' LOOP
    SELECT record INTO y FROM horizon_projects WHERE id=x->>'initiativeId';
    IF y IS NULL OR y->>'sourceIdeaId' IS DISTINCT FROM x->>'id' THEN RAISE EXCEPTION 'Missing linked initiative'; END IF;
  END LOOP;
  RETURN jsonb_build_object('ideas',jsonb_array_length(p_ideas),'projects',jsonb_array_length(p_projects));
END $$;
REVOKE ALL ON FUNCTION public.horizon_import(jsonb,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.horizon_import(jsonb,jsonb) TO service_role;
