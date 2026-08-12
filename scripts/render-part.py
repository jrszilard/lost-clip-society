"""
render-part.py — neutral-resin product render of a part STL, for the site.

Run headless:
  blender --background --python scripts/render-part.py -- \
      --stl /path/to/part.stl --out public/images/parts/<slug>.png \
      [--az -38] [--el 26] [--size 2.2]

Brand rules baked in (BRAND.md: "color is chrome, never product"):
  - part material is ALWAYS the same warm ivory "neutral resin"
  - seamless warm-cream backdrop (matches --brand-cream / showroom brochure)
  - soft three-point daylight, squared-off evidentiary framing, no props
"""
import bpy
import math
import sys
from mathutils import Vector

# ---- args -----------------------------------------------------------------
argv = sys.argv[sys.argv.index("--") + 1:]
def arg(name, default):
    return argv[argv.index(name) + 1] if name in argv else default

STL   = arg("--stl", None)
OUT   = arg("--out", "render.png")
AZ    = math.radians(float(arg("--az", -38)))   # camera azimuth
EL    = math.radians(float(arg("--el", 26)))    # camera elevation
SIZE  = float(arg("--size", 2.2))               # normalized max part dimension
RES_X, RES_Y = 1024, 768

CREAM_PART  = (0.600, 0.510, 0.375, 1.0)   # neutral resin (deep ivory for AgX)
CREAM_STAGE = (0.910, 0.875, 0.790, 1.0)   # --brand-cream, shaded for AgX

# ---- scene ----------------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

for engine in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "CYCLES"):
    try:
        scene.render.engine = engine
        break
    except Exception:
        continue
try:
    scene.eevee.use_raytracing = True
except Exception:
    pass

bpy.ops.wm.stl_import(filepath=STL)
imported = [o for o in bpy.context.selected_objects if o.type == "MESH"]
assert imported, "no mesh imported"
bpy.ops.object.select_all(action="SELECT")
bpy.context.view_layer.objects.active = imported[0]
if len(imported) > 1:
    bpy.ops.object.join()
part = bpy.context.view_layer.objects.active

# normalize: uniform scale so max dimension == SIZE, centered in XY, base at z=0
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bb = [part.matrix_world @ Vector(c) for c in part.bound_box]
lo = Vector((min(v.x for v in bb), min(v.y for v in bb), min(v.z for v in bb)))
hi = Vector((max(v.x for v in bb), max(v.y for v in bb), max(v.z for v in bb)))
dim = hi - lo
s = SIZE / max(dim)
part.scale = (s, s, s)
bpy.ops.object.transform_apply(scale=True)
mid = (lo + hi) / 2 * s
part.location = (-mid.x, -mid.y, -lo.z * s)
bpy.ops.object.transform_apply(location=True)

# smooth shading by angle (fall back to full smooth)
try:
    with bpy.context.temp_override(active_object=part, object=part,
                                   selected_objects=[part],
                                   selected_editable_objects=[part]):
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(40))
except Exception:
    for p in part.data.polygons:
        p.use_smooth = True

def make_mat(color, rough):
    m = bpy.data.materials.new("mat")
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = rough
    return m

part.data.materials.append(make_mat(CREAM_PART, 0.52))

# stage: big seamless floor in brand cream
bpy.ops.mesh.primitive_plane_add(size=4000, location=(0, 0, -0.002))
floor = bpy.context.active_object
floor.data.materials.append(make_mat(CREAM_STAGE, 0.95))

world = bpy.data.worlds.new("cream")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = CREAM_STAGE
world.node_tree.nodes["Background"].inputs[1].default_value = 1.0
scene.world = world

# ---- lights ----------------------------------------------------------------
target = bpy.data.objects.new("target", None)
target.location = (0, 0, SIZE * 0.42)
scene.collection.objects.link(target)

def area(name, loc, energy, size, color):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    data.color = color
    ob = bpy.data.objects.new(name, data)
    ob.location = loc
    scene.collection.objects.link(ob)
    con = ob.constraints.new("TRACK_TO")
    con.target = target
    con.track_axis = "TRACK_NEGATIVE_Z"
    con.up_axis = "UP_Y"

area("key",  (-4.5, -3.5, 6.5),  750, 3.0, (1.0, 0.955, 0.885))   # warm daylight
area("fill", ( 5.0, -1.5, 3.0),  260, 2.5, (0.92, 0.95, 1.0))      # cool fill
area("rim",  ( 1.0,  4.5, 6.0),  700, 2.0, (1.0, 0.97, 0.93))      # top/back rim

# ---- camera ----------------------------------------------------------------
cam_data = bpy.data.cameras.new("cam")
cam_data.lens = 58
cam = bpy.data.objects.new("cam", cam_data)
R = 7.0
cam.location = (R * math.cos(EL) * math.sin(AZ),
                -R * math.cos(EL) * math.cos(AZ),
                R * math.sin(EL))
scene.collection.objects.link(cam)
con = cam.constraints.new("TRACK_TO")
con.target = target
con.track_axis = "TRACK_NEGATIVE_Z"
con.up_axis = "UP_Y"
scene.camera = cam

# ---- render ----------------------------------------------------------------
scene.render.resolution_x = RES_X
scene.render.resolution_y = RES_Y
scene.view_settings.exposure = 0.0
scene.render.filepath = OUT
scene.render.image_settings.file_format = "PNG"
try:
    scene.render.image_settings.color_mode = "RGB"
except Exception:
    pass
bpy.ops.render.render(write_still=True)
print(f"WROTE {OUT}")
