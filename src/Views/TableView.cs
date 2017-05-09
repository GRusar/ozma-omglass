namespace FunWithFlags.FunApp.Views
{
    using System;
    using System.Dynamic;
    using System.Linq;
    using System.Collections.Generic;

    using FunWithFlags.FunCore;
    using FunWithFlags.FunDB;

    public class TableView : View
    {
        public string ViewName
        {
            get { return "Table"; }
        }

        public ViewType ViewType
        {
            get { return ViewType.Multiple; }
        }

        public ExpandoObject Get(DatabaseContext db, DBQuery userDb, UserView uv)
        {
            dynamic model = new ExpandoObject();
            

            //dynamic dbmodel = new ExpandoObject();
            var dbmodel = db.Entities.Where(e =>
                db.UVEntities.Where(uve =>
                    uve.EntityId == e.Id &&
                    uve.UserViewId == uv.Id
                ).Any()
            ).GroupJoin(db.Fields,
                ent => ent.Id,
                fld => fld.EntityId,
                (ent, fld) => new {
                    Entity = ent,
                    Fields = fld.Where(tf =>
                        tf.EntityId == ent.Id
                    ).ToList()
                }
            ).ToList();
            

            /*
            const string quote = "\"";

            var strs = new List<Tuple<string, string>>();
            dynamic flds = dbmodel.Entries[0].Fields;
            string tstr = "";

            for(int i = 0; i < flds.Count; i++) {
                tstr = flds[i].Name;
                strs.Add(Tuple.Create(tstr,string.Join(null, quote, tstr, quote)));
            }
             */

            var strs = dbmodel[0].Fields.Select(f => Tuple.Create(f.Name, $"\"{f.Name}\""));

            model.Entries = userDb.Query(dbmodel[0].Entity.Name, strs, "");

            /*
            model.Entries = userDb.Query("Tests", new[]
                    {
                        Tuple.Create("Name", "\"Name\""),
                        Tuple.Create("Count", "\"Count\""),
                        Tuple.Create("Description", "\"Description\""),
                        Tuple.Create("Param1", "\"Param1\""),
                        Tuple.Create("Param2", "\"Param2\""),
                    }, ""
            );
              */

            model.Titles = db.UVFields.Where(uvf =>
                uvf.UserViewId == uv.Id
            ).ToList();
 
            model.View = uv;

            return model;
        }
    }
}
